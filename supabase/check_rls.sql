SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;