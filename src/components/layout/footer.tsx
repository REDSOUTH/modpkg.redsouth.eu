import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Moon, Sun, Laptop, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import "flag-icons/css/flag-icons.min.css";

const LANGUAGES = [
  { code: "en", label: "English", flag: "fi fi-us" },
  { code: "es", label: "Español", flag: "fi fi-es" },
  { code: "pt", label: "Português", flag: "fi fi-br" },
  { code: "fr", label: "Français", flag: "fi fi-fr" },
  { code: "de", label: "Deutsch", flag: "fi fi-de" },
];

export default function Footer() {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentLang = i18n.language || "en";

  return (
    <footer className="pt-8 pb-8 border-t border-border bg-background/50 text-sm text-muted-foreground transition-colors duration-200">
      <div className="max-w-[1920px] mx-auto w-full px-6">
        {/* Main Grid: 5 columns on large screens */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-8">
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <a
              href="https://redsouth.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-2 hover:opacity-80 transition-opacity"
            >
              <img
                src="/redsouth/banner.svg"
                alt="REDSOUTH Studio"
                className="h-12 w-auto select-none"
                draggable="false"
              />
            </a>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("footer.description")}
            </p>
          </div>

          {/* Ecosystem / Projects Col */}
          <div className="col-span-1">
            <h3 className="font-semibold mb-2 text-sm text-foreground">{t("footer.projects")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://modpkg.redsouth.eu" className="hover:text-foreground transition-colors">
                  MODPKG
                </a>
              </li>
              <li>
                <a href="https://onelauncher.redsouth.eu" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  ONE Launcher
                </a>
              </li>
              <li>
                <a href="https://redsouth.eu/account" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  REDSOUTH Account
                </a>
              </li>
            </ul>
          </div>

          {/* Community Col */}
          <div className="col-span-1">
            <h3 className="font-semibold mb-2 text-sm text-foreground">{t("footer.community_title")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://github.com/REDSOUTH/modpkg.redsouth.eu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.source_code")}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/REDSOUTH/modpkg.redsouth.eu/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.report_issue")}
                </a>
              </li>
              <li>
                <a
                  href="https://buymeacoffee.com/redsouth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.support")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Col */}
          <div className="col-span-1">
            <h3 className="font-semibold mb-2 text-sm text-foreground">{t("footer.legal_title")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://redsouth.eu/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.terms")}
                </a>
              </li>
              <li>
                <a
                  href="https://redsouth.eu/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.privacy")}
                </a>
              </li>
              <li>
                <a
                  href="https://redsouth.eu/legal/cookies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.cookies")}
                </a>
              </li>
              <li>
                <a
                  href="https://redsouth.eu/legal/trademarks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.trademarks")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Controls */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center md:text-left flex flex-col gap-1">
            <span>© {new Date().getFullYear()} REDSOUTH Studio. {t("footer.rights")}</span>
            <span className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-400/90 max-w-2xl font-normal">
              {t("footer.minecraft_disclaimer")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Scroll to Top */}
            <Button
              variant="ghost"
              size="icon"
              onClick={scrollToTop}
              className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Scroll to top</span>
            </Button>

            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className={`cursor-pointer ${theme === "light" ? "bg-accent/50" : ""}`}
                >
                  <Sun className="h-4 w-4 mr-2" /> {t("footer.theme.light")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className={`cursor-pointer ${theme === "dark" ? "bg-accent/50" : ""}`}
                >
                  <Moon className="h-4 w-4 mr-2" /> {t("footer.theme.dark")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className={`cursor-pointer ${theme === "system" ? "bg-accent/50" : ""}`}
                >
                  <Laptop className="h-4 w-4 mr-2" /> {t("footer.theme.system")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <Globe className="h-4 w-4" />
                  <span>{LANGUAGES.find((l) => currentLang.startsWith(l.code))?.label || "English"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[140px]">
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`cursor-pointer ${
                      currentLang.startsWith(lang.code) ? "bg-accent/50 font-medium" : ""
                    }`}
                  >
                    <span className={`${lang.flag} text-base rounded-[2px] overflow-hidden mr-2`}></span>{" "}
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </footer>
  );
}
