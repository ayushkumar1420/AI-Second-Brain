import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Brain, FilePlus2, Home, Link as LinkIcon, LogOut, MessageSquare, Moon, Search, Sparkles, StickyNote, Sun, User } from "lucide-react";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const nav = [
  { to: "/app", label: "Dashboard", icon: Home },
  { to: "/app/notes", label: "Notes", icon: StickyNote },
  { to: "/app/upload", label: "Upload", icon: FilePlus2 },
  { to: "/app/links", label: "Links", icon: LinkIcon },
  { to: "/app/search", label: "Search", icon: Search },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/insights", label: "Insights", icon: Sparkles },
];

export default function AppLayout() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 text-ink dark:bg-zinc-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-fern text-white">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-ink dark:text-white">Second Brain</p>
            <p className="text-xs text-stone-500">Private knowledge AI</p>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-emerald-100 text-fern dark:bg-emerald-950" : "text-stone-600 hover:bg-stone-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button className="flex items-center gap-2 font-bold text-ink dark:text-white lg:hidden" onClick={() => navigate("/app")}>
              <Brain className="h-6 w-6 text-fern" />
              Second Brain
            </button>
            <div className="hidden text-sm text-stone-500 dark:text-zinc-400 sm:block">{user?.displayName || "Second Brain User"}</div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-10 w-10 px-0" onClick={toggleTheme} title="Toggle theme">
                {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <Button variant="secondary" className="h-10 w-10 px-0" onClick={() => navigate("/app/profile")} title="Profile">
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" className="h-10 w-10 px-0 text-stone-600 dark:text-zinc-300" onClick={logout} title="Log out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/app"} className="flex shrink-0 items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-600 dark:bg-zinc-900 dark:text-zinc-300">
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
