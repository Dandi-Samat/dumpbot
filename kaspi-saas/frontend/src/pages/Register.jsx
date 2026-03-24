import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import api from '../api/client'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('token', data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="text-red-500" size={32} />
            <span className="text-3xl font-bold">Kaspi Pro</span>
          </div>
          <p className="text-gray-400">Создайте аккаунт продавца</p>
        </div>

        <form onSubmit={submit} className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold mb-6">Регистрация</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Имя</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                placeholder="Ваше имя"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Номер телефона</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                placeholder="+7 777 123 45 67"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Пароль</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                placeholder="Минимум 6 символов"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>

          <p className="text-center text-sm text-gray-400 mt-4">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-red-400 hover:text-red-300">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
