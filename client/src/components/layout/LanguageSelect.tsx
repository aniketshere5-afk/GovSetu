import { useTranslation } from "react-i18next";
import { Check, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSelect() {
  const { i18n, t } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find(l => i18n.language?.startsWith(l.code)) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="gov-toolbtn" aria-label={t("idbar.language")}>
        <Globe size={14} aria-hidden />
        <span>{current.native}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>{t("idbar.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => void i18n.changeLanguage(lang.code)}
            aria-current={current.code === lang.code ? "true" : undefined}
          >
            <span className="inline-flex w-4 justify-center">
              {current.code === lang.code ? <Check size={14} aria-hidden /> : null}
            </span>
            <span className="flex-1">{lang.native}</span>
            <span className="text-xs text-muted-foreground">
              {lang.label}
              {lang.ready ? "" : " · soon"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
