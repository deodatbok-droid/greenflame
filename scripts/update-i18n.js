const fs = require('fs');
const path = require('path');

const NEW_DASHBOARD_FR = {
  level1Label: 'Débutant',
  level2Label: 'Bâtisseur',
  level3Label: 'Partenaire',
  level4Label: 'Leader',
  level5Label: 'Kingmaker',
  lifeGoal1: 'Micro-assurance maladie',
  lifeGoal2: 'Crédits clinique',
  lifeGoal3: 'Bons scolaires enfants',
  lifeGoal4: 'Liberté totale',
  lifeGoalTiers: '{n} paliers',
  lifeGoalInProgress: 'EN COURS',
  lifeGoalPerMonth: '/mois',
  lifeGoalRemaining: 'Encore {amount} FCFA/mois · Communauté de {n} membres requise',
  lifeGoalFirstPurchase: 'Effectuez votre premier achat pour commencer à progresser vers vos objectifs.',
  voucherTitle: 'Bon de retrait',
  voucherDesc: "Envoyez de l'argent — retirez en espèces chez un marchand",
  tontineTitle: 'Ma tontine',
  tontineDesc: "Gérez et suivez les cotisations de votre groupe d'épargne",
  openShopTitle: 'Ouvrez votre boutique',
  openShopDesc: 'Vendez vos produits ou services · Gardez votre session consommateur',
  dividendTitle: 'Qu’est-ce que les dividendes communautaires ?',
  dividendExplain: "Chaque fois qu'une personne de votre chaîne de parrainage achète chez un marchand, 40 % de la commission est répartie sur 5 niveaux. Vous recevez automatiquement votre part — sans rien faire.",
  dividendSince: 'depuis le 1er {month}',
  referralLocked: 'Code de parrainage verrouillé',
  referralLockedDesc: 'Effectuez votre premier achat pour débloquer votre code et inviter des membres.',
  referralLink: 'Votre lien de parrainage',
  referralExplain: "Partagez ce lien → toute personne inscrite via ce lien devient votre affilié N1. Vous gagnez sur ses achats (et ceux de sa chaîne, jusqu'au niveau N5).",
  demoTitle: 'Simuler un achat GreenFlame',
  demoDesc: 'Voir comment la commission se distribue sur 5 niveaux',
  merchantSpace: 'Espace marchand',
};

const NEW_DASHBOARD_EN = {
  level1Label: 'Beginner',
  level2Label: 'Builder',
  level3Label: 'Partner',
  level4Label: 'Leader',
  level5Label: 'Kingmaker',
  lifeGoal1: 'Micro health insurance',
  lifeGoal2: 'Clinic credits',
  lifeGoal3: "Children's school vouchers",
  lifeGoal4: 'Total freedom',
  lifeGoalTiers: '{n} tiers',
  lifeGoalInProgress: 'IN PROGRESS',
  lifeGoalPerMonth: '/month',
  lifeGoalRemaining: '{amount} FCFA/month more · {n}-member community required',
  lifeGoalFirstPurchase: 'Make your first purchase to start progressing toward your goals.',
  voucherTitle: 'Withdrawal Voucher',
  voucherDesc: 'Send money — withdraw cash at a merchant',
  tontineTitle: 'My savings group',
  tontineDesc: 'Manage and track your savings group contributions',
  openShopTitle: 'Open your store',
  openShopDesc: 'Sell products or services · Keep your consumer session',
  dividendTitle: 'What are community dividends?',
  dividendExplain: 'Every time someone in your referral chain buys from a merchant, 40% of the commission is split across 5 levels. You automatically receive your share — effortlessly.',
  dividendSince: 'since {month} 1st',
  referralLocked: 'Referral code locked',
  referralLockedDesc: 'Make your first purchase to unlock your code and invite members.',
  referralLink: 'Your referral link',
  referralExplain: 'Share this link → anyone who signs up via this link becomes your L1 affiliate. You earn on their purchases and their chain’s purchases, up to level L5.',
  demoTitle: 'Simulate a GreenFlame purchase',
  demoDesc: 'See how commission is distributed across 5 levels',
  merchantSpace: 'Merchant space',
};

const NEW_PAY_FR = {
  payingAt: 'Paiement chez',
  scanQrBanner: 'Scannez le QR code du marchand',
  scanQrBannerStart: 'Appuyez pour commencer →',
  mobileNumberDebit: 'Numéro {method} à débiter',
  mobileNumberEditHint: 'modifiable si autre téléphone',
  ussdNote: 'Le code USSD sera à composer depuis ce numéro.',
  amountLabel: 'Montant à payer',
  voiceHint: '🎤 ou dictez le montant',
  specificRate: 'Taux produit spécifique',
  merchantRate: 'Taux {merchant}',
  gfpFractionNote: '1 FCFA = 10 GFP · Les fractions sont créditées en GFP',
  insufficientFunds: 'Solde insuffisant : {amount} FCFA disponibles',
  confirmWithMerchant: 'Confirmer →',
  identifyMerchant: 'Identifier le marchand →',
  back: 'Retour',
  scanInstruction: 'Scannez le QR code du marchand pour valider',
  cameraLoading: '📷 Démarrage de la caméra…',
  noMerchantFound: 'Aucune boutique trouvée pour « {query} »',
  pinWalletTitle: 'Code PIN wallet',
  pinWalletSubtitle: 'Entrez votre code PIN pour confirmer',
  availableBalance: 'Solde disponible',
  afterPayment: 'Après paiement : {amount} FCFA',
  pinInputLabel: 'Code PIN (6 chiffres)',
  cameraAccessDenied: 'Accès caméra refusé',
  merchantNotFound: 'Marchand introuvable ou inactif',
  ussdDialCode: 'Composez ce code sur votre téléphone',
  ussdOpenDialer: '📞 Ouvrir le dialer automatiquement',
  ussdFromNumber: 'Depuis le numéro : {number}',
  ussdIphoneNote: 'iPhone : copiez le code et composez-le manuellement',
  ussdFollowInstructions: 'Suivez les instructions sur votre téléphone',
  paymentFailed: 'Paiement échoué',
  connectionError: 'Erreur de connexion',
  notConnected: 'Non connecté',
};

const NEW_PAY_EN = {
  payingAt: 'Payment at',
  scanQrBanner: "Scan the merchant's QR code",
  scanQrBannerStart: 'Tap to start →',
  mobileNumberDebit: '{method} number to debit',
  mobileNumberEditHint: 'change if using another phone',
  ussdNote: 'The USSD code must be entered from this number.',
  amountLabel: 'Amount to pay',
  voiceHint: '🎤 or dictate the amount',
  specificRate: 'Product-specific rate',
  merchantRate: '{merchant} rate',
  gfpFractionNote: '1 FCFA = 10 GFP · Fractions credited as GFP',
  insufficientFunds: 'Insufficient balance: {amount} FCFA available',
  confirmWithMerchant: 'Confirm →',
  identifyMerchant: 'Identify merchant →',
  back: 'Back',
  scanInstruction: "Scan the merchant's QR code to proceed",
  cameraLoading: '📷 Starting camera…',
  noMerchantFound: 'No store found for "{query}"',
  pinWalletTitle: 'Wallet PIN',
  pinWalletSubtitle: 'Enter your PIN to confirm',
  availableBalance: 'Available balance',
  afterPayment: 'After payment: {amount} FCFA',
  pinInputLabel: 'PIN code (6 digits)',
  cameraAccessDenied: 'Camera access denied',
  merchantNotFound: 'Merchant not found or inactive',
  ussdDialCode: 'Enter this code on your phone',
  ussdOpenDialer: '📞 Open dialer automatically',
  ussdFromNumber: 'From number: {number}',
  ussdIphoneNote: 'iPhone: copy the code and enter it manually',
  ussdFollowInstructions: 'Follow the instructions on your phone',
  paymentFailed: 'Payment failed',
  connectionError: 'Connection error',
  notConnected: 'Not connected',
};

const NEW_WALLET_FR = {
  noEarnings: 'Aucun gain enregistré pour le moment.',
  minWithdrawFcfa: 'Retrait FCFA minimum : {amount} FCFA',
  minWithdrawRemaining: 'Encore {amount} FCFA avant de pouvoir retirer',
  ledgerBalance: 'Solde :',
};

const NEW_WALLET_EN = {
  noEarnings: 'No earnings recorded yet.',
  minWithdrawFcfa: 'Minimum FCFA withdrawal: {amount} FCFA',
  minWithdrawRemaining: '{amount} FCFA more needed to withdraw',
  ledgerBalance: 'Balance:',
};

const NEW_MERCHANT_TOPBAR_FR = {
  backHome: '← Accueil',
  history: 'Historique',
  adminLink: '🛡️ Admin',
};

const NEW_MERCHANT_TOPBAR_EN = {
  backHome: '← Home',
  history: 'History',
  adminLink: '🛡️ Admin',
};

const NEW_ADMIN_FR = {
  title: 'GreenFlame Admin',
  backToApp: '← App',
  nav: {
    dashboard: 'Dashboard',
    float: '⚖️ Float',
    merchants: 'Marchands',
    members: 'Membres',
    transactions: 'Transactions',
    withdrawals: 'Retraits',
    kyc: 'KYC',
    revenue: 'Revenus GF',
    marketplace: 'Marketplace',
  },
};

const NEW_ADMIN_EN = {
  title: 'GreenFlame Admin',
  backToApp: '← App',
  nav: {
    dashboard: 'Dashboard',
    float: '⚖️ Float',
    merchants: 'Merchants',
    members: 'Members',
    transactions: 'Transactions',
    withdrawals: 'Withdrawals',
    kyc: 'KYC',
    revenue: 'GF Revenue',
    marketplace: 'Marketplace',
  },
};

function updateJson(filePath, dashNew, payNew, walletNew, merchantTopBarNew, adminNew) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  Object.assign(data.dashboard, dashNew);
  Object.assign(data.pay, payNew);
  Object.assign(data.wallet, walletNew);
  data.merchant.topBar = merchantTopBarNew;
  data.admin = adminNew;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated: ' + filePath);
}

updateJson(
  path.join(__dirname, '../messages/fr.json'),
  NEW_DASHBOARD_FR, NEW_PAY_FR, NEW_WALLET_FR, NEW_MERCHANT_TOPBAR_FR, NEW_ADMIN_FR
);
updateJson(
  path.join(__dirname, '../messages/en.json'),
  NEW_DASHBOARD_EN, NEW_PAY_EN, NEW_WALLET_EN, NEW_MERCHANT_TOPBAR_EN, NEW_ADMIN_EN
);

console.log('Done. Verifying key counts...');
const fr = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/fr.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));
console.log('fr.dashboard keys:', Object.keys(fr.dashboard).length);
console.log('en.dashboard keys:', Object.keys(en.dashboard).length);
console.log('fr.pay keys:', Object.keys(fr.pay).length);
console.log('en.pay keys:', Object.keys(en.pay).length);
console.log('fr admin nav keys:', Object.keys(fr.admin.nav).length);
console.log('en admin nav keys:', Object.keys(en.admin.nav).length);
