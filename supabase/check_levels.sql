SELECT level, distribution_type, COUNT(*) AS nb, SUM(amount_fcfa) AS total
FROM commission_distributions cd
WHERE recipient_id = (SELECT id FROM users WHERE phone='+22997025083')
GROUP BY level, distribution_type
ORDER BY distribution_type, level;