export function MetaConfigErrorHint({ className }: { className?: string }) {
  return (
    <ol
      className={
        className ??
        "text-muted-foreground mt-2 list-decimal space-y-1 pl-4 text-left text-xs"
      }
    >
      <li>
        En tu archivo <code className="text-foreground">.env</code>, completa{" "}
        <code className="text-foreground">META_ACCESS_TOKEN</code> y{" "}
        <code className="text-foreground">META_AD_ACCOUNT_ID</code>.
      </li>
      <li>Reinicia el servidor con `pnpm dev`.</li>
      <li>
        En Vercel, configúralas en Settings → Environment Variables (Production)
        y vuelve a desplegar.
      </li>
    </ol>
  )
}
