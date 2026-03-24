import { useState, useEffect } from 'react'
import { Check, Zap, Crown, Star } from 'lucide-react'
import api from '../api/client'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    icon: Star,
    color: 'gray',
    features: [
      'До 5 товаров',
      'Ручной запуск демпинга',
      'Базовая аналитика',
      '1 магазин',
    ],
    disabled: ['Авто-демпинг по расписанию', 'WhatsApp рассылка', 'Приоритетная поддержка'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 2990,
    icon: Zap,
    color: 'blue',
    popular: false,
    features: [
      'До 50 товаров',
      'Авто-демпинг каждый час',
      'Полная аналитика',
      'До 3 магазинов',
      'Управление заказами',
    ],
    disabled: ['WhatsApp рассылка', 'Приоритетная поддержка'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5990,
    icon: Crown,
    color: 'red',
    popular: true,
    features: [
      'Неограниченно товаров',
      'Авто-демпинг каждые 15 минут',
      'Полная аналитика + отчёты',
      'Неограниченно магазинов',
      'Управление заказами',
      'WhatsApp рассылка',
      'Приоритетная поддержка',
    ],
    disabled: [],
  },
]

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setCurrentPlan(data.plan || 'free')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const colorMap = {
    gray: { border: 'border-gray-700', badge: 'bg-gray-700 text-gray-300', btn: 'bg-gray-700 hover:bg-gray-600 text-white' },
    blue: { border: 'border-blue-600/30', badge: 'bg-blue-500/10 text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
    red: { border: 'border-red-600/30', badge: 'bg-red-500/10 text-red-400', btn: 'bg-red-600 hover:bg-red-700 text-white' },
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Подписка</h1>
        <p className="text-gray-400 mt-1">Выберите план для вашего бизнеса</p>
      </div>

      {currentPlan !== 'free' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Check size={18} className="text-green-400" />
          <span className="text-sm text-green-300">
            Активный план: <strong>{PLANS.find(p => p.id === currentPlan)?.name}</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const colors = colorMap[plan.color]
          const isCurrent = currentPlan === plan.id
          const Icon = plan.icon

          return (
            <div key={plan.id} className={`relative bg-gray-900 border ${colors.border} rounded-xl p-6 ${plan.popular ? 'ring-1 ring-red-600/50' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-medium">Популярный</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-lg ${colors.badge}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <div className="text-2xl font-bold mt-0.5">
                    {plan.price === 0 ? 'Бесплатно' : `${plan.price.toLocaleString()}₸`}
                    {plan.price > 0 && <span className="text-sm text-gray-500 font-normal">/мес</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={14} className="text-green-400 shrink-0" />
                    {f}
                  </div>
                ))}
                {plan.disabled.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-3.5 h-3.5 shrink-0 text-center leading-none">—</span>
                    {f}
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="w-full text-center py-2.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400">
                  Текущий план
                </div>
              ) : plan.price === 0 ? (
                <div className="w-full text-center py-2.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400">
                  Базовый
                </div>
              ) : (
                <button
                  onClick={() => alert('Оплата через Kaspi Pay — скоро!\n\nДля подключения свяжитесь с поддержкой.')}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${colors.btn}`}
                >
                  Подключить за {plan.price.toLocaleString()}₸/мес
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="font-semibold mb-3">Оплата</h3>
        <p className="text-sm text-gray-400">
          Принимаем оплату через Kaspi Pay, банковскую карту и счёт на оплату для юридических лиц.
          По вопросам подключения обращайтесь в поддержку.
        </p>
      </div>
    </div>
  )
}
