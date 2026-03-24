import { HelpCircle, MessageCircle, Book, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const FAQ = [
  {
    q: 'Как добавить магазин?',
    a: 'Перейдите в Профиль → Магазины → Добавить. Введите Seller ID (merchantUid) и куки из браузера после входа в Kaspi Merchant Cabinet.'
  },
  {
    q: 'Как получить куки Kaspi?',
    a: '1. Войдите в mc.shop.kaspi.kz\n2. Откройте DevTools (F12) → Application → Cookies\n3. Скопируйте все куки для kaspi.kz\n4. Вставьте в поле "Kaspi куки" при добавлении магазина.'
  },
  {
    q: 'Как работает демпинг?',
    a: 'Система проверяет цены конкурентов на Kaspi и снижает вашу цену на шаг (по умолчанию 1₸) ниже минимальной цены конкурентов. Если снижение нарушит минимальную маржу — цена не изменится.'
  },
  {
    q: 'Что такое SKU?',
    a: 'SKU — уникальный идентификатор товара на Kaspi в формате 108549494_582117366. Найти его можно в URL страницы товара или в кабинете продавца. Без SKU демпинг не работает.'
  },
  {
    q: 'Что такое предзаказ?',
    a: 'Предзаказ — функция Kaspi для товаров, которых нет в наличии. Вы указываете количество дней доставки, и Kaspi показывает товар как "под заказ". Авто-снижение автоматически уменьшает срок доставки.'
  },
  {
    q: 'Почему демпинг не работает?',
    a: 'Проверьте:\n• Добавлен ли SKU товара\n• Активен ли магазин (куки не истекли)\n• Включён ли демпинг для товара (переключатель в Товарах)\n• Не достигнута ли минимальная цена/маржа'
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm font-medium">{q}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-400 whitespace-pre-line border-t border-gray-800 pt-3">
          {a}
        </div>
      )}
    </div>
  )
}

export default function Help() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Помощь</h1>
        <p className="text-gray-400 mt-1">База знаний и поддержка</p>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={18} className="text-green-400" />
            <h3 className="font-semibold text-sm">Написать в поддержку</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">Ответим в течение нескольких часов</p>
          <a
            href="https://t.me/kaspiproSupport"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Telegram поддержка
          </a>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Book size={18} className="text-yellow-400" />
            <h3 className="font-semibold text-sm">Документация</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">Подробные инструкции по всем функциям</p>
          <button
            onClick={() => alert('Документация в разработке')}
            className="w-full text-center bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Открыть документацию
          </button>
        </div>
      </div>

      {/* FAQ */}
      <h2 className="font-semibold mb-4">Частые вопросы</h2>
      <div className="space-y-2">
        {FAQ.map((item, i) => <FaqItem key={i} {...item} />)}
      </div>
    </div>
  )
}
