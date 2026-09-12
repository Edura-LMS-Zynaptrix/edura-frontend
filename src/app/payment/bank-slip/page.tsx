'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { uploadBankSlipThunk, clearPaymentError, fetchBankAccountsThunk } from '@/lib/redux/slices/paymentSlice'
import { getErrorMessage } from '@/lib/utils'

export default function BankSlipUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    }>
      <BankSlipContent />
    </Suspense>
  )
}

function BankSlipContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams?.get('payment_id')
  const bankId = searchParams?.get('bank_id')

  const dispatch = useAppDispatch()
  const { isLoading: loading, error, bankAccounts } = useAppSelector((state) => state.payment)

  const selectedBank = bankAccounts.find(acc => acc.id === bankId)

  const [localError, setLocalError] = useState('')
  const [success, setSuccess] = useState(false)
  const [slipImage, setSlipImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    bank_name: '',
    depositor_name: '',
    deposit_date: '',
    reference_number: ''
  })

  // Load bank accounts if not already loaded (e.g. page refresh)
  useEffect(() => {
    if (bankAccounts.length === 0) {
      dispatch(fetchBankAccountsThunk(false))
    }
  }, [dispatch, bankAccounts.length])

  // Pre-fill bank name if selected
  useEffect(() => {
    if (selectedBank) {
      setFormData(prev => ({ ...prev, bank_name: selectedBank.bank_name }))
    }
  }, [selectedBank])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setLocalError('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setLocalError('Image size must be less than 5MB')
        return
      }
      setSlipImage(file)
      setImagePreview(URL.createObjectURL(file))
      setLocalError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentId) {
      setLocalError('Payment ID is missing')
      return
    }

    if (!slipImage) {
      setLocalError('Please select a bank slip image')
      return
    }

    try {
      dispatch(clearPaymentError())
      setLocalError('')

      await dispatch(uploadBankSlipThunk({
        payment_id: paymentId,
        slip_image: slipImage,
        bank_name: formData.bank_name || undefined,
        depositor_name: formData.depositor_name || undefined,
        deposit_date: formData.deposit_date || undefined,
        reference_number: formData.reference_number || undefined
      })).unwrap()

      setSuccess(true)
    } catch (err: any) {
      // Handled by Redux natively if backend error, or local fallback
      if (err?.message) setLocalError(err.message)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bank Slip Uploaded!</h2>
            <p className="text-gray-600 mb-6">
              Your payment slip has been submitted successfully. Our team will verify it within 24 hours and activate your account.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You will receive a notification once your payment is verified.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload Bank Slip</h1>
          <p className="text-gray-600 mb-6">Please upload your bank deposit slip for verification</p>

          {/* Bank Details */}
          {selectedBank ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <h3 className="font-bold text-gray-900 leading-tight">Selected Bank for Deposit</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold mb-0.5">Bank Name</p>
                  <p className="font-semibold text-gray-900">{selectedBank.bank_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold mb-0.5">Account Number</p>
                  <p className="font-mono font-bold text-gray-900 tracking-widerSelection">{selectedBank.account_number}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold mb-0.5">Account Name</p>
                  <p className="font-semibold text-gray-900">{selectedBank.account_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-teal-600 font-bold mb-0.5">Branch</p>
                  <p className="font-semibold text-gray-900">{selectedBank.branch}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Bank Details for Deposit</h3>
              <div className="space-y-1 text-sm animate-pulse">
                <div className="h-4 bg-blue-100 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-blue-100 rounded w-1/2"></div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bank Slip Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Slip Image <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Bank slip preview" className="max-h-64 mx-auto rounded" />
                    <button
                      type="button"
                      onClick={() => {
                        setSlipImage(null)
                        setImagePreview(null)
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="slip-upload"
                />
                <label
                  htmlFor="slip-upload"
                  className="mt-4 inline-block px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {imagePreview ? 'Change Image' : 'Select Image'}
                </label>
              </div>
            </div>

            {/* Bank Name */}
            <div>
              <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name (Optional)
              </label>
              <input
                type="text"
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="e.g., Commercial Bank"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Depositor Name */}
            <div>
              <label htmlFor="depositor_name" className="block text-sm font-medium text-gray-700 mb-2">
                Depositor Name (Optional)
              </label>
              <input
                type="text"
                id="depositor_name"
                value={formData.depositor_name}
                onChange={(e) => setFormData({ ...formData, depositor_name: e.target.value })}
                placeholder="Name on the deposit slip"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Deposit Date */}
            <div>
              <label htmlFor="deposit_date" className="block text-sm font-medium text-gray-700 mb-2">
                Deposit Date (Optional)
              </label>
              <input
                type="date"
                id="deposit_date"
                value={formData.deposit_date}
                onChange={(e) => setFormData({ ...formData, deposit_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Reference Number */}
            <div>
              <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700 mb-2">
                Reference/Transaction Number (Optional)
              </label>
              <input
                type="text"
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Transaction reference number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {localError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {localError}
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !slipImage}
                className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Uploading...' : 'Submit for Verification'}
              </button>
            </div>
          </form>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Please ensure the bank slip image is clear and all details are visible. 
              Your account will be activated within 24 hours after admin verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
