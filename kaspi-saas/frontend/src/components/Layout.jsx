import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, MessageCircle,
  CreditCard, Settings, LogOut, Zap, User, HelpCircle, Star
} from 'lucide-react'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { to: '/products', icon: Package, label: 'Товары' },
  { to: '/orders', icon: ShoppingCart, label: 'Заказы' },
  { to: '/reviews', icon: Star, label: 'Отзывы' },
  { to: '/whatsapp', icon: MessageCircle, label: 'Рассылка' },
  { to: '/subscription', icon: CreditCard, label: 'Подписка' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
]

const bottomNav = [
  { to: '/profile', icon: User, label: 'Профиль' },
  { to: '/help', icon: HelpCircle, label: 'Помощь' },
]

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Zap className="text-red-500" size={24} />
            <span className="text-xl font-bold">Kaspi Pro</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Seller Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          {bottomNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-red-400 text-sm w-full rounded-lg hover:bg-gray-800 transition-colors mt-1"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
