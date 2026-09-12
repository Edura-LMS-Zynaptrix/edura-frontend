'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { 
  fetchBankAccountsThunk, 
  createBankAccountThunk, 
  updateBankAccountThunk, 
  deleteBankAccountThunk,
  clearPaymentError 
} from '@/lib/redux/slices/paymentSlice'
import { BankAccountCreate, BankAccountUpdate, BankAccount } from '@/lib/api/payment'

export default function AdminBankAccountsPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const { bankAccounts, isLoading: loading, error } = useAppSelector((state) => state.payment)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<BankAccountCreate>({
    bank_name: '',
    account_number: '',
    account_name: '',
    branch: '',
    is_active: true,
    order_number: 0
  })

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      router.push('/dashboard')
      return
    }
    dispatch(fetchBankAccountsThunk(true))
  }, [user, dispatch, router])

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingId(account.id)
      setFormData({
        bank_name: account.bank_name,
        account_number: account.account_number,
        account_name: account.account_name,
        branch: account.branch,
        is_active: account.is_active,
        order_number: account.order_number
      })
    } else {
      setEditingId(null)
      setFormData({
        bank_name: '',
        account_number: '',
        account_name: '',
        branch: '',
        is_active: true,
        order_number: bankAccounts.length
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    dispatch(clearPaymentError())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await dispatch(updateBankAccountThunk({ id: editingId, data: formData })).unwrap()
      } else {
        await dispatch(createBankAccountThunk(formData)).unwrap()
      }
      handleCloseModal()
    } catch (err) {
      // Error handled by Redux
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account? Students will no longer see it.')) {
      try {
        await dispatch(deleteBankAccountThunk(id)).unwrap()
      } catch (err) {
        // Error handled by Redux
      }
    }
  }

  const toggleStatus = async (account: BankAccount) => {
    try {
      await dispatch(updateBankAccountThunk({ 
        id: account.id, 
        data: { is_active: !account.is_active } 
      })).unwrap()
    } catch (err) {
      // Error handled by Redux
    }
  }

  if (user?.role !== 'admin' && user?.role !== 'super_admin') return null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bank Accounts</h1>
            <p className="text-gray-600 mt-1">Manage the bank details students use for deposits</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-semibold"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Account
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && bankAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
            <p className="text-gray-500">Loading bank accounts...</p>
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Bank Accounts Found</h3>
            <p className="text-gray-500 mb-6">Add your first bank account to start receiving manual deposits.</p>
            <button
              onClick={() => handleOpenModal()}
              className="text-teal-600 hover:text-teal-700 font-bold"
            >
              Add Account Now →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bankAccounts.map((account) => (
              <div 
                key={account.id} 
                className={`relative group bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                  account.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
                }`}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4 z-20">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="p-6 pb-20">
                  {/* Bank Card Graphic */}
                  <div className={`aspect-[1.58/1] w-full rounded-xl p-5 mb-6 text-white overflow-hidden relative ${
                    account.is_active 
                      ? 'bg-gradient-to-br from-teal-700 to-teal-900 shadow-lg' 
                      : 'bg-gradient-to-br from-gray-600 to-gray-800'
                  }`}>
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-5"></div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-bold mb-0.5">Platform Bank</p>
                          <p className="font-bold text-lg leading-tight truncate w-40">{account.bank_name}</p>
                        </div>
                        <svg className="w-8 h-8 opacity-40 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium mb-1">Account Number</p>
                        <p className="font-mono text-xl tracking-wider font-semibold">{account.account_number}</p>
                      </div>
                      
                      <div className="flex justify-between items-end gap-2">
                        <div className="truncate">
                          <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium truncate">Account Name</p>
                          <p className="text-xs font-medium truncate">{account.account_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium">Branch</p>
                          <p className="text-xs font-medium">{account.branch}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Table */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500">Order Priority</span>
                      <span className="font-medium text-gray-900">{account.order_number}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Created At</span>
                      <span className="text-gray-900">{new Date(account.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(account)}
                      className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Edit Account"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleStatus(account)}
                      className={`p-2 rounded-lg transition-colors ${
                        account.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={account.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {account.is_active ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Account"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
              {/* Form Side */}
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingId ? 'Edit Bank Account' : 'New Bank Account'}
                  </h2>
                  <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 lg:hidden">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Bank Name</label>
                      <input
                        type="text"
                        required
                        value={formData.bank_name}
                        onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                        placeholder="e.g. Commercial Bank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Account Number</label>
                      <input
                        type="text"
                        required
                        value={formData.account_number}
                        onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                        placeholder="e.g. 1234 5678 90"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Account Name</label>
                    <input
                      type="text"
                      required
                      value={formData.account_name}
                      onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                      placeholder="e.g. Edura (Pvt) Ltd"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Branch</label>
                      <input
                        type="text"
                        required
                        value={formData.branch}
                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                        placeholder="e.g. City Office"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Display Order</label>
                      <input
                        type="number"
                        value={formData.order_number}
                        onChange={(e) => setFormData({...formData, order_number: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Activate this account (Make it visible to students)
                    </label>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-3 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 font-bold shadow-lg shadow-teal-600/20 transition-all"
                    >
                      {loading ? 'Saving...' : editingId ? 'Update Account' : 'Save Account'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Preview Side */}
              <div className="w-full lg:w-96 bg-gray-50 p-6 sm:p-8 border-l border-gray-100 flex flex-col justify-center">
                <div className="hidden lg:block mb-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Live Preview</h3>
                  <p className="text-xs text-gray-500">This is how it will look during student checkout.</p>
                </div>
                
                {/* Preview Bank Card */}
                <div className={`aspect-[1.58/1] w-full max-w-sm mx-auto rounded-2xl p-6 text-white overflow-hidden relative shadow-2xl transition-all duration-500 ${
                  formData.is_active 
                    ? 'bg-gradient-to-br from-teal-700 to-teal-900' 
                    : 'bg-gradient-to-br from-gray-600 to-gray-800'
                }`}>
                  <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-white opacity-5 mix-blend-overlay"></div>
                  <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 rounded-full bg-white opacity-5 mix-blend-overlay"></div>
                  
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-teal-200/60 font-bold mb-1">Direct Transfer</p>
                        <p className="font-bold text-xl tracking-tight h-7 overflow-hidden">{formData.bank_name || 'Your Bank Name'}</p>
                      </div>
                      <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium mb-1">Account Number</p>
                      <p className="font-mono text-2xl tracking-[0.1em] font-semibold h-8 overflow-hidden">{formData.account_number || '•••• •••• ••••'}</p>
                    </div>
                    
                    <div className="flex justify-between items-end gap-4 overflow-hidden">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium truncate">Account Name</p>
                        <p className="text-sm font-medium truncate h-5">{formData.account_name || 'Account Holder'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-widest text-teal-200/60 font-medium">Branch</p>
                        <p className="text-sm font-medium h-5">{formData.branch || 'Main Branch'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 lg:mt-12 text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-teal-600 mb-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider">Dynamic Activation</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto lg:mx-0">
                    Active bank accounts appear instantly on student payment pages. Use "Order Priority" to sort which ones show first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
