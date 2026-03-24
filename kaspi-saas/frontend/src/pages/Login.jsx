import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import api from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('username', form.phone)
      params.append('password', form.password)
      const { data } = await api.post('/auth/login', params)
      localStorage.setItem('token', data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка входа')
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
          <p className="text-gray-400">Панель управления для Kaspi продавцов</p>
        </div>

        <form onSubmit={submit} className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold mb-6">Вход в аккаунт</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
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
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>

          <p className="text-center text-sm text-gray-400 mt-4">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-red-400 hover:text-red-300">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
