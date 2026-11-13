-- Comentarios IA TikTok sin modo dry run.
-- Las decisiones de corridas dry nunca se aplicaron en TikTok, pero bloqueaban el
-- comentario para siempre (dedupe por tiktokCommentId). Se borran para que la
-- próxima corrida los procese si siguen dentro de la ventana de 7 días.
DELETE FROM "TikTokCommentDecision"
WHERE "runId" IN (SELECT "id" FROM "TikTokCommentAgentRun" WHERE "dryRun" = true);

DELETE FROM "TikTokCommentAgentRun" WHERE "dryRun" = true;

ALTER TABLE "TikTokCommentAgentRun" DROP COLUMN "dryRun";

-- Cuenta TikTok de la decisión (para reintentar con las credenciales correctas).
ALTER TABLE "TikTokCommentDecision" ADD COLUMN "accountId" TEXT;
