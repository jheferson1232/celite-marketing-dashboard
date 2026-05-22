export function MetaConfigErrorHint({ className }: { className?: string }) {
  return (
    <ol
      className={
        className ??
        "text-muted-foreground mt-2 list-decimal space-y-1 pl-4 text-left text-xs"
      }
    >
      <li>
        Copia <code className="text-foreground">.env.example</code> a{" "}
        <code className="text-foreground">.env.local</code> (o restaura desde{" "}
        <code className="text-foreground">.env.bak</code> si ya tenías las
        claves).
      </li>
      <li>
        Completa <code className="text-foreground">META_ACCESS_TOKEN</code> y{" "}
        <code className="text-foreground">META_AD_ACCOUNT_ID</code>.
      </li>
      <li>Reinicia el servidor con `pnpm dev`.</li>
    </ol>
  )
}
