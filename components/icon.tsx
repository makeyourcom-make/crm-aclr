/**
 * Wrapper pour rendre une icône Lucide par son nom (string).
 *
 * On centralise pour éviter d'importer des dizaines d'icônes dans chaque
 * composant. Les icônes utilisées par les routes sont déclarées dans
 * `lib/routes.ts` par leur nom de string.
 */
import {
  BarChart3,
  Banknote,
  Calendar,
  FileSpreadsheet,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Mail,
  MailOpen,
  MailPlus,
  MapPin,
  MessageSquare,
  Globe,
  Package,
  PenTool,
  Percent,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Receipt,
  Repeat,
  Settings,
  StickyNote,
  Sun,
  Target,
  TrendingUp,
  Users,
  Video,
  Search,
  LogOut,
  Menu,
  ChevronRight,
  Construction,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  BarChart3,
  Banknote,
  Calendar,
  FileSpreadsheet,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Mail,
  MailOpen,
  MailPlus,
  MapPin,
  MessageSquare,
  Globe,
  Package,
  PenTool,
  Percent,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Receipt,
  Repeat,
  Settings,
  StickyNote,
  Sun,
  Target,
  TrendingUp,
  Users,
  Video,
  Search,
  LogOut,
  Menu,
  ChevronRight,
  Construction,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
}

export function Icon({ name, className, ...props }: IconProps) {
  const Comp = (ICONS as Record<string, LucideIcon>)[name];
  if (!Comp) {
    // Fallback discret pour éviter un crash si un nom d'icône est erroné
    return null;
  }
  return <Comp className={className} {...props} />;
}
