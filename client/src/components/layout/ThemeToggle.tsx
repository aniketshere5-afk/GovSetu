import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const options = [
    { value: "light", label: t("idbar.themeLight"), icon: Sun },
    { value: "dark", label: t("idbar.themeDark"), icon: Moon },
    { value: "system", label: t("idbar.themeSystem"), icon: Monitor },
  ] as const;
  const Active = (options.find(o => o.value === theme) ?? options[2]).icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="gov-toolbtn" aria-label={t("idbar.theme")}>
        <Active size={14} aria-hidden />
        <span className="hidden sm:inline">{t("idbar.theme")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            aria-current={theme === value ? "true" : undefined}
          >
            <Icon size={15} aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
