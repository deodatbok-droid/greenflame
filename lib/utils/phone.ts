/**
 * Normalise un numéro de téléphone béninois (+229) en format canonique E.164.
 *
 * Règle : les anciens 8 chiffres (97025083) et les nouveaux 10 chiffres avec
 * préfixe "01" (0197025083) désignent la MÊME ligne physique au Bénin depuis
 * la migration de 2024. On normalise toujours vers l'ancien format 8 chiffres
 * afin que login et lookup tombent sur le même enregistrement.
 *
 *   97025083        →  +22997025083
 *   0197025083      →  +22997025083  (préfixe "01" retiré)
 *   +22997025083    →  +22997025083  (inchangé)
 *   +2290197025083  →  +22997025083  (préfixe "01" retiré)
 *
 * Autres pays : le numéro est retourné tel quel en E.164.
 */
export function normalizePhone(input: string): string {
  if (!input) return input

  let full: string

  if (input.startsWith('+')) {
    full = input
  } else {
    const digits = input.replace(/\D/g, '')
    if (digits.startsWith('229')) {
      full = '+' + digits
    } else if (digits.startsWith('01') && digits.length === 10) {
      // "0197025083" sans + → Bénin nouveau format, retirer "01"
      full = '+229' + digits.slice(2)
    } else if (digits.startsWith('0')) {
      full = '+229' + digits.slice(1)
    } else {
      full = '+229' + digits
    }
  }

  // Normalisation Bénin : +229 + local 10 chiffres commençant par "01" → retirer "01"
  if (full.startsWith('+229')) {
    const local = full.slice(4)
    if (local.length === 10 && local.startsWith('01')) {
      return '+229' + local.slice(2)
    }
  }

  return full
}
