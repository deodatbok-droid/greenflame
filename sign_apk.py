#!/usr/bin/env python3
"""GreenFlame APK Signer v3 - Python cryptography library"""
import sys, struct, hashlib, zipfile, io, base64, datetime
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding as apad
from cryptography.hazmat.primitives.serialization import pkcs7, Encoding, PrivateFormat, NoEncryption
from cryptography.x509.oid import NameOID

INPUT_APK  = sys.argv[1] if len(sys.argv) > 1 else "GreenFlame-unsigned.apk"
OUTPUT_APK = sys.argv[2] if len(sys.argv) > 2 else "GreenFlame.apk"
CERTS_DIR  = Path(__file__).parent / "certs"
KEY_FILE   = CERTS_DIR / "gf_key.pem"
CERT_FILE  = CERTS_DIR / "gf_cert.pem"

def load_or_generate():
    CERTS_DIR.mkdir(exist_ok=True)
    if KEY_FILE.exists() and CERT_FILE.exists():
        print("  Keys: loading from certs/")
        priv = serialization.load_pem_private_key(KEY_FILE.read_bytes(), password=None)
        cert = x509.load_pem_x509_certificate(CERT_FILE.read_bytes())
    else:
        print("  Keys: generating new 2048-bit RSA pair...")
        priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subj = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "GreenFlame"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "GreenFlame Africa"),
            x509.NameAttribute(NameOID.COUNTRY_NAME, "BJ"),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subj).issuer_name(subj)
            .public_key(priv.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=10000))
            .sign(priv, hashes.SHA256())
        )
        KEY_FILE.write_bytes(priv.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()))
        CERT_FILE.write_bytes(cert.public_bytes(Encoding.PEM))
        print("  Keys: saved to certs/")
    return priv, cert

sha256_b64 = lambda d: base64.b64encode(hashlib.sha256(d).digest()).decode()

def should_sign(name):
    u = name.upper()
    if u == "META-INF/MANIFEST.MF": return False
    if u.startswith("META-INF/") and (u.endswith(".SF") or u.endswith(".RSA") or u.endswith(".DSA")):
        return False
    return True

def build_manifest(entries):
    lines = ["Manifest-Version: 1.0", "Created-By: GreenFlame Signer", ""]
    for name in sorted(entries):
        lines += ["Name: " + name, "SHA-256-Digest: " + entries[name], ""]
    return "\r\n".join(lines).encode()

def build_sf(manifest, entries):
    lines = ["Signature-Version: 1.0",
             "SHA-256-Digest-Manifest: " + sha256_b64(manifest),
             "Created-By: GreenFlame Signer", ""]
    for name in sorted(entries):
        section = ("Name: " + name + "\r\nSHA-256-Digest: " + entries[name] + "\r\n\r\n").encode()
        lines += ["Name: " + name, "SHA-256-Digest: " + sha256_b64(section), ""]
    return "\r\n".join(lines).encode()

def v1_sign(src, priv, cert):
    with zipfile.ZipFile(src, "r") as z:
        entries = {n: sha256_b64(z.read(n)) for n in z.namelist() if should_sign(n)}
    manifest = build_manifest(entries)
    sf_data  = build_sf(manifest, entries)
    cert_rsa = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf_data)
        .add_signer(cert, priv, hashes.SHA256())
        .sign(Encoding.DER, [pkcs7.PKCS7Options.NoCapabilities])
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(src, "r") as sz, zipfile.ZipFile(buf, "w") as dz:
        for item in sz.infolist():
            u = item.filename.upper()
            if u.startswith("META-INF/") and (
                u.endswith(".SF") or u.endswith(".RSA") or u.endswith(".DSA")
                or u == "META-INF/MANIFEST.MF"
            ):
                continue
            dz.writestr(item, sz.read(item.filename))
        mf = zipfile.ZipInfo("META-INF/MANIFEST.MF"); mf.compress_type = zipfile.ZIP_DEFLATED
        sf = zipfile.ZipInfo("META-INF/CERT.SF");     sf.compress_type = zipfile.ZIP_DEFLATED
        rs = zipfile.ZipInfo("META-INF/CERT.RSA");    rs.compress_type = zipfile.ZIP_STORED
        dz.writestr(mf, manifest)
        dz.writestr(sf, sf_data)
        dz.writestr(rs, cert_rsa)
    data = buf.getvalue()
    print("  V1: " + str(len(data)//1024) + " Ko, " + str(len(zipfile.ZipFile(io.BytesIO(data)).namelist())) + " entries")
    return data

lp = lambda data: struct.pack("<I", len(data)) + data
sha256 = lambda d: hashlib.sha256(d).digest()
CHUNK = 1024 * 1024
SIG_ALGO = 0x0103

def chunk_digests(sec):
    out, off = [], 0
    while off < len(sec):
        c = sec[off:off + CHUNK]
        prefix = b"\xa5" + struct.pack("<I", len(c))
        out.append(sha256(prefix + c))
        off += CHUNK
    return out

def content_digest(s1, s2, s3):
    chunks = chunk_digests(s1) + chunk_digests(s2) + chunk_digests(s3)
    header = b"\x5a" + struct.pack("<I", len(chunks))
    return sha256(header + b"".join(chunks))

def v2_sign(apk_bytes, priv, cert):
    data     = apk_bytes
    eocd_off = data.rfind(b"\x50\x4b\x05\x06")
    cd_off   = struct.unpack_from("<I", data, eocd_off + 16)[0]
    sec3_r   = bytearray(data[eocd_off:])
    struct.pack_into("<I", sec3_r, 16, cd_off)
    dig = content_digest(data[:cd_off], data[cd_off:eocd_off], bytes(sec3_r))

    cert_der   = cert.public_bytes(Encoding.DER)
    pubkey_der = cert.public_key().public_bytes(Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)

    signed_data = (
        lp(lp(struct.pack("<I", SIG_ALGO) + lp(dig)))
        + lp(lp(cert_der))
        + lp(b"")
    )
    sig_bytes  = priv.sign(signed_data, apad.PKCS1v15(), hashes.SHA256())
    signatures = lp(lp(struct.pack("<I", SIG_ALGO) + lp(sig_bytes)))
    signer     = lp(signed_data) + signatures + lp(pubkey_der)
    v2_value   = lp(lp(signer))

    id_pair    = struct.pack("<Q", 4 + len(v2_value)) + struct.pack("<I", 0x7109871a) + v2_value
    blk_size   = len(id_pair) + 8 + 16
    sig_block  = struct.pack("<Q", blk_size) + id_pair + struct.pack("<Q", blk_size) + b"APK Sig Block 42"

    new_cd_off = cd_off + len(sig_block)
    new_eocd   = bytearray(data[eocd_off:])
    struct.pack_into("<I", new_eocd, 16, new_cd_off)
    final = data[:cd_off] + sig_block + data[cd_off:eocd_off] + bytes(new_eocd)
    print("  V2: " + str(len(final)//1024) + " Ko, block " + str(len(sig_block)) + " bytes")
    return final

print("\n[GreenFlame APK Signer v3]")
print("Input : " + INPUT_APK)
print("Output: " + OUTPUT_APK + "\n")
priv, cert = load_or_generate()
print("[1/2] V1 signing...")
v1_bytes = v1_sign(INPUT_APK, priv, cert)
print("[2/2] V2 signing...")
final = v2_sign(v1_bytes, priv, cert)
with open(OUTPUT_APK, "wb") as f:
    f.write(final)
zf    = zipfile.ZipFile(io.BytesIO(final))
names = zf.namelist()
dupes = [n for n in names if names.count(n) > 1]
print("\nDone: " + str(len(final)//1024) + " Ko | " + str(len(names)) + " entries | " + str(len(dupes)) + " duplicates")
