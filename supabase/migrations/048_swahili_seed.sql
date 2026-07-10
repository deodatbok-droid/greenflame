-- ================================================================
-- GreenFlame — Swahili Seed Data (100 words + 7 lessons)
-- 048_swahili_seed.sql
-- ================================================================

INSERT INTO swahili_words (swahili, french, english, theme, difficulty, example_sw, example_fr) VALUES

-- ── COMMERCE (30) ────────────────────────────────────────────────
('biashara',   'commerce / affaires',  'business / trade',    'commerce', 1, 'Biashara nzuri!',         'Bonne affaire !'),
('bei',        'prix',                 'price',               'commerce', 1, 'Bei gani?',               'Quel est le prix ?'),
('nunua',      'acheter',              'to buy',              'commerce', 1, 'Nataka kununua hii.',     'Je veux acheter ceci.'),
('uza',        'vendre',              'to sell',             'commerce', 1, 'Unauzaje?',               'Combien tu vends ?'),
('pesa',       'argent',              'money',               'commerce', 1, 'Nina pesa kidogo.',       'J''ai peu d''argent.'),
('soko',       'marché',              'market',              'commerce', 1, 'Nenda sokoni.',           'Va au marché.'),
('duka',       'boutique / magasin',  'shop / store',        'commerce', 1, 'Duka liko wapi?',         'Où est la boutique ?'),
('bidhaa',     'produit / marchandise','product / goods',    'commerce', 2, 'Bidhaa hii ni nzuri.',    'Ce produit est bon.'),
('malipo',     'paiement',            'payment',             'commerce', 2, 'Malipo yamekamilika.',    'Le paiement est effectué.'),
('stakabadhi', 'reçu',                'receipt',             'commerce', 2, 'Toa stakabadhi.',         'Donne un reçu.'),
('faida',      'bénéfice / profit',   'profit / benefit',    'commerce', 2, 'Faida yake ni kubwa.',    'Son profit est grand.'),
('akiba',      'épargne',             'savings',             'commerce', 2, 'Weka akiba kila siku.',   'Épargne chaque jour.'),
('mkoba',      'portefeuille',        'wallet',              'commerce', 1, 'Mkoba wako una pesa?',    'Ton portefeuille a de l''argent ?'),
('mteja',      'client',              'customer',            'commerce', 2, 'Mteja ni mfalme.',        'Le client est roi.'),
('muuzaji',    'vendeur',             'seller / vendor',     'commerce', 2, 'Muuzaji ni mkarimu.',     'Le vendeur est généreux.'),
('mnunuzi',    'acheteur',            'buyer',               'commerce', 2, 'Mnunuzi anapenda bei rahisi.', 'L''acheteur aime les prix bas.'),
('thamani',    'valeur',              'value / worth',       'commerce', 2, 'Thamani yake ni nzuri.',  'Sa valeur est bonne.'),
('punguzo',    'réduction / remise',  'discount',            'commerce', 2, 'Kuna punguzo leo?',       'Il y a une réduction aujourd''hui ?'),
('agizo',      'commande',            'order',               'commerce', 2, 'Agizo lako liko tayari.', 'Ta commande est prête.'),
('mkopo',      'crédit / prêt',       'loan / credit',       'commerce', 3, 'Nataka mkopo mdogo.',     'Je veux un petit prêt.'),
('amana',      'dépôt / confiance',   'deposit / trust',     'commerce', 3, 'Weka amana banki.',       'Fais un dépôt à la banque.'),
('rejesho',    'remboursement',       'refund / return',     'commerce', 3, 'Nataka rejesho.',         'Je veux un remboursement.'),
('jumla',      'en gros / total',     'wholesale / total',   'commerce', 3, 'Ninauzaje jumla?',        'Comment vends-tu en gros ?'),
('hesabu',     'calcul / compte',     'calculation / account','commerce', 2,'Hesabu yako ni sawa.',    'Ton calcul est juste.'),
('benki',      'banque',              'bank',                'commerce', 1, 'Nenda benki asubuhi.',    'Va à la banque le matin.'),
('fedha',      'argent / finances',   'money / finance',     'commerce', 2, 'Fedha ni muhimu.',        'L''argent est important.'),
('mauzo',      'ventes',              'sales',               'commerce', 2, 'Mauzo yetu ni mazuri.',   'Nos ventes sont bonnes.'),
('bei rahisi', 'pas cher / abordable','cheap / affordable',  'commerce', 1, 'Bei rahisi sana!',        'Très bon marché !'),
('bei ghali',  'cher',                'expensive',           'commerce', 1, 'Bei ghali mno.',          'Trop cher.'),
('ushuru',     'taxe / frais',        'tax / fee',           'commerce', 3, 'Ushuru ni mdogo.',        'La taxe est faible.'),

-- ── GREETINGS (15) ───────────────────────────────────────────────
('jambo',      'bonjour (informel)',   'hello (informal)',    'greetings', 1, 'Jambo rafiki!',           'Bonjour ami !'),
('habari',     'comment ça va ?',     'how are you?',        'greetings', 1, 'Habari yako?',            'Comment tu vas ?'),
('nzuri',      'bien / beau',         'good / fine / nice',  'greetings', 1, 'Nzuri sana, asante.',    'Très bien, merci.'),
('asante',     'merci',               'thank you',           'greetings', 1, 'Asante sana!',            'Merci beaucoup !'),
('karibu',     'bienvenue / de rien', 'welcome / you''re welcome', 'greetings', 1, 'Karibu GreenFlame!', 'Bienvenue sur GreenFlame !'),
('tafadhali',  's''il vous plaît',    'please',              'greetings', 1, 'Tafadhali nisaidie.',    'Aidez-moi, s''il vous plaît.'),
('samahani',   'pardon / excusez-moi','sorry / excuse me',   'greetings', 1, 'Samahani sana.',         'Vraiment désolé.'),
('ndiyo',      'oui',                 'yes',                 'greetings', 1, 'Ndiyo, sawa.',           'Oui, d''accord.'),
('hapana',     'non',                 'no',                  'greetings', 1, 'Hapana, asante.',        'Non, merci.'),
('sawa',       'd''accord / bien',   'okay / alright',      'greetings', 1, 'Sawa kabisa!',           'Tout à fait d''accord !'),
('kwaheri',    'au revoir',           'goodbye',             'greetings', 1, 'Kwaheri, tutaonana.',    'Au revoir, à bientôt.'),
('shikamoo',   'salut respectueux (aux aînés)', 'respectful greeting (to elders)', 'greetings', 2, 'Shikamoo bibi.', 'Bonjour grand-mère (avec respect).'),
('marahaba',   'réponse à shikamoo', 'response to shikamoo','greetings', 2, 'Marahaba mwanangu.',     'Je vous salue, mon enfant.'),
('hujambo',    'comment allez-vous ?','how are you? (sg)',   'greetings', 1, 'Hujambo daktari?',       'Comment allez-vous, docteur ?'),
('sijambo',    'je vais bien',        'I am fine',           'greetings', 1, 'Sijambo, asante.',       'Je vais bien, merci.'),

-- ── NUMBERS (10) ─────────────────────────────────────────────────
('moja',   'un',   'one',   'numbers', 1, 'Moja kwa moja.',     'Un par un.'),
('mbili',  'deux', 'two',   'numbers', 1, 'Watu wawili.',       'Deux personnes.'),
('tatu',   'trois','three', 'numbers', 1, 'Hatua tatu.',        'Trois étapes.'),
('nne',    'quatre','four', 'numbers', 1, 'Pembe nne.',         'Quatre coins.'),
('tano',   'cinq', 'five',  'numbers', 1, 'Ngazi tano.',        'Cinq niveaux.'),
('sita',   'six',  'six',   'numbers', 1, 'Masaa sita.',        'Six heures.'),
('saba',   'sept', 'seven', 'numbers', 1, 'Siku saba.',         'Sept jours.'),
('nane',   'huit', 'eight', 'numbers', 1, 'Miaka nane.',        'Huit ans.'),
('tisa',   'neuf', 'nine',  'numbers', 1, 'Nafasi tisa.',       'Neuf chances.'),
('kumi',   'dix',  'ten',   'numbers', 1, 'FCFA kumi.',         'Dix FCFA.'),

-- ── COMMUNITY (20) ───────────────────────────────────────────────
('jamii',       'communauté',          'community',           'community', 1, 'Jamii yangu ni nguvu.',   'Ma communauté est forte.'),
('familia',     'famille',             'family',              'community', 1, 'Familia yangu ni kubwa.', 'Ma famille est grande.'),
('rafiki',      'ami / amie',          'friend',              'community', 1, 'Rafiki wa kweli.',        'Un vrai ami.'),
('ndugu',       'frère / camarade',    'brother / comrade',   'community', 1, 'Ndugu yangu!',            'Mon frère !'),
('mtu',         'personne',            'person',              'community', 1, 'Mtu mzuri.',              'Une bonne personne.'),
('watu',        'personnes / gens',    'people',              'community', 1, 'Watu wengi.',             'Beaucoup de gens.'),
('pamoja',      'ensemble',            'together',            'community', 1, 'Pamoja tunaweza.',        'Ensemble nous pouvons.'),
('umoja',       'unité',               'unity',               'community', 1, 'Umoja ni nguvu.',         'L''unité est la force.'),
('upendo',      'amour',               'love',                'community', 1, 'Upendo ni muhimu.',       'L''amour est important.'),
('amani',       'paix',                'peace',               'community', 1, 'Tunataka amani.',         'Nous voulons la paix.'),
('nguvu',       'force / puissance',   'strength / power',    'community', 1, 'Nguvu zetu ni kubwa.',    'Notre force est grande.'),
('heshima',     'respect',             'respect',             'community', 2, 'Heshima ni thamani.',     'Le respect a de la valeur.'),
('imani',       'foi / confiance',     'faith / trust',       'community', 2, 'Imani yangu ni kubwa.',   'Ma foi est grande.'),
('tumaini',     'espoir',              'hope',                'community', 2, 'Tumaini halikufi.',       'L''espoir ne meurt pas.'),
('furaha',      'joie / bonheur',      'joy / happiness',     'community', 1, 'Furaha ya mioyo.',        'La joie des cœurs.'),
('shukrani',    'gratitude',           'gratitude',           'community', 2, 'Shukrani nyingi.',        'Beaucoup de gratitude.'),
('msaada',      'aide / assistance',   'help / assistance',   'community', 1, 'Nahitaji msaada.',        'J''ai besoin d''aide.'),
('mshirika',    'partenaire',          'partner / associate', 'community', 2, 'Mshirika wa biashara.',   'Partenaire commercial.'),
('mwanachama',  'membre',              'member',              'community', 2, 'Mwanachama mpya.',        'Nouveau membre.'),
('jirani',      'voisin',              'neighbor',            'community', 1, 'Jirani wangu ni wazuri.', 'Mes voisins sont bons.'),

-- ── FOOD (15) ────────────────────────────────────────────────────
('chakula',  'nourriture / repas',  'food / meal',    'food', 1, 'Chakula kiko tayari.',  'La nourriture est prête.'),
('maji',     'eau',                 'water',          'food', 1, 'Nataka maji baridi.',   'Je veux de l''eau froide.'),
('mkate',    'pain',                'bread',          'food', 1, 'Mkate wa leo ni mzuri.','Le pain du jour est bon.'),
('nyama',    'viande',              'meat',           'food', 1, 'Nyama ya ng''ombe.',    'Viande de bœuf.'),
('samaki',   'poisson',             'fish',           'food', 1, 'Samaki wa bahari.',     'Poisson de mer.'),
('matunda',  'fruits',              'fruits',         'food', 1, 'Matunda ya Afrika.',    'Les fruits d''Afrique.'),
('mboga',    'légumes',             'vegetables',     'food', 1, 'Mboga za kijani.',      'Légumes verts.'),
('chai',     'thé',                 'tea',            'food', 1, 'Chai ya asubuhi.',      'Thé du matin.'),
('kahawa',   'café',                'coffee',         'food', 1, 'Kahawa nzuri sana.',    'Très bon café.'),
('wali',     'riz cuit',            'cooked rice',    'food', 1, 'Wali na nyama.',        'Riz avec de la viande.'),
('mahindi',  'maïs / maïs',        'corn / maize',   'food', 1, 'Mahindi ya shamba.',    'Maïs du champ.'),
('ndizi',    'banane',              'banana',         'food', 1, 'Ndizi tano.',           'Cinq bananes.'),
('embe',     'mangue',              'mango',          'food', 1, 'Embe tamu sana.',       'Mangue très sucrée.'),
('nyanya',   'tomate',              'tomato',         'food', 1, 'Nyanya nyekundu.',      'Tomate rouge.'),
('mayai',    'œufs',                'eggs',           'food', 1, 'Mayai manne.',          'Quatre œufs.'),

-- ── PHILOSOPHY / GREENFLAME (10) ─────────────────────────────────
('ubuntu',      'humanité / je suis parce que nous sommes', 'humanity / I am because we are', 'philosophy', 2, 'Ubuntu ni falsafa yetu.', 'Ubuntu est notre philosophie.'),
('maendeleo',   'progrès / développement', 'progress / development', 'philosophy', 2, 'Tunataka maendeleo.',   'Nous voulons le progrès.'),
('mafanikio',   'succès / réussite',       'success',                'philosophy', 2, 'Mafanikio ni yetu.',    'Le succès nous appartient.'),
('ushindi',     'victoire',                'victory',                'philosophy', 2, 'Ushindi ni wetu!',      'La victoire est nôtre !'),
('ujasiri',     'courage / audace',        'courage / boldness',     'philosophy', 2, 'Ujasiri ni lazima.',    'Le courage est nécessaire.'),
('mwanga',      'lumière',                 'light',                  'philosophy', 1, 'Mwanga wa Afrika.',     'La lumière de l''Afrique.'),
('safari',      'voyage / parcours',       'journey / travel',       'philosophy', 1, 'Safari ya mafanikio.',  'Le voyage vers le succès.'),
('kesho',       'demain / l''avenir',      'tomorrow / the future',  'philosophy', 1, 'Kesho ni nzuri.',       'Demain sera meilleur.'),
('Afrika',      'Afrique',                 'Africa',                 'philosophy', 1, 'Afrika ni nyumbani.',   'L''Afrique est chez nous.'),
('nguvu za pamoja', 'force collective',    'collective strength',    'philosophy', 2, 'Nguvu za pamoja ni kubwa.', 'La force collective est grande.')
ON CONFLICT DO NOTHING;


-- ── LESSONS ──────────────────────────────────────────────────────
INSERT INTO swahili_lessons (slug, title_fr, title_en, subtitle_fr, subtitle_en, theme, level, emoji, position) VALUES
('biashara-1',  'Biashara — Le Commerce',        'Biashara — Commerce',        'Les mots du marché', 'Market vocabulary',           'commerce',    1, '🛒', 1),
('salamu-1',    'Salamu — Les Salutations',      'Salamu — Greetings',         'Parler comme un Africain', 'Speak like an African', 'greetings',   1, '👋', 2),
('nambari-1',   'Nambari — Les Chiffres',        'Nambari — Numbers',          '1 à 10 en Swahili', '1 to 10 in Swahili',          'numbers',     1, '🔢', 3),
('jamii-1',     'Jamii — La Communauté',         'Jamii — Community',          'Les liens qui unissent', 'The bonds that unite',   'community',   1, '🤝', 4),
('chakula-1',   'Chakula — La Nourriture',       'Chakula — Food',             'Manger en Swahili', 'Eat in Swahili',              'food',        1, '🍽️', 5),
('ubuntu-1',    'Ubuntu — Notre Philosophie',    'Ubuntu — Our Philosophy',    'Je suis parce que nous sommes', 'I am because we are', 'philosophy', 1, '🌍', 6),
('biashara-2',  'Biashara 2 — Commerce Avancé', 'Biashara 2 — Advanced Trade','Clients, valeur, profit', 'Customers, value, profit', 'commerce',   2, '💰', 7)
ON CONFLICT (slug) DO NOTHING;


-- ── WIRE WORDS TO LESSONS ─────────────────────────────────────────
-- Lesson 1: Biashara-1 (commerce basics — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'biashara-1') l,
  (VALUES
    ('biashara',1), ('bei',2), ('nunua',3), ('uza',4),
    ('pesa',5), ('soko',6), ('duka',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 2: Salamu-1 (greetings — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'salamu-1') l,
  (VALUES
    ('jambo',1), ('habari',2), ('nzuri',3), ('asante',4),
    ('karibu',5), ('sawa',6), ('kwaheri',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 3: Nambari-1 (numbers 1-10)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'nambari-1') l,
  (VALUES
    ('moja',1), ('mbili',2), ('tatu',3), ('nne',4), ('tano',5),
    ('sita',6), ('saba',7), ('nane',8), ('tisa',9), ('kumi',10)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 4: Jamii-1 (community — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'jamii-1') l,
  (VALUES
    ('jamii',1), ('pamoja',2), ('umoja',3), ('rafiki',4),
    ('ndugu',5), ('upendo',6), ('heshima',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 5: Chakula-1 (food — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'chakula-1') l,
  (VALUES
    ('chakula',1), ('maji',2), ('mkate',3), ('matunda',4),
    ('chai',5), ('ndizi',6), ('embe',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 6: Ubuntu-1 (philosophy — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'ubuntu-1') l,
  (VALUES
    ('ubuntu',1), ('pamoja',2), ('umoja',3), ('maendeleo',4),
    ('mafanikio',5), ('Afrika',6), ('kesho',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;

-- Lesson 7: Biashara-2 (advanced commerce — 7 words)
INSERT INTO swahili_lesson_words (lesson_id, word_id, position)
SELECT l.id, sw.id, w.pos FROM
  (SELECT id FROM swahili_lessons WHERE slug = 'biashara-2') l,
  (VALUES
    ('bidhaa',1), ('malipo',2), ('mteja',3), ('muuzaji',4),
    ('thamani',5), ('faida',6), ('akiba',7)
  ) AS w(swahili, pos)
  JOIN swahili_words sw ON sw.swahili = w.swahili
ON CONFLICT DO NOTHING;
