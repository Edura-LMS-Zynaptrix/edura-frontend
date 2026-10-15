'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchPayHereConfigThunk, clearCurrentConfig, clearPaymentError } from '@/lib/redux/slices/paymentSlice'

declare global {
  interface Window {
    payhere: any
  }
}

export default function PayHerePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    }>
      <PayHereContent />
    </Suspense>
  )
}

function PayHereContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams?.get('payment_id')

  const dispatch = useAppDispatch()
  const { currentPaymentConfig: config, isLoading: loading, error } = useAppSelector((state) => state.payment)

  const [localError, setLocalError] = useState('')
  const [localLoading, setLocalLoading] = useState(true)

  useEffect(() => {
    if (!paymentId) {
      setLocalError('Payment ID is required')
      setLocalLoading(false)
      return
    }

    loadPayHereConfig()
  }, [paymentId])

  const loadPayHereConfig = async () => {
    try {
      dispatch(clearPaymentError())
      await dispatch(fetchPayHereConfigThunk(paymentId!)).unwrap()

      // Load PayHere script
      const script = document.createElement('script')
      script.src = 'https://www.payhere.lk/lib/payhere.js'
      script.async = true
      script.onload = () => {
        console.log('PayHere script loaded')
      }
      script.onerror = () => {
        console.error('Failed to load payment gateway')
      }
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
      }
    } catch (err: any) {
      // Error handled by Redux
    }
  }

  const initiatePayHerePayment = () => {
    if (!config || !window.payhere) {
      console.error('Payment gateway not ready')
      return
    }

    const payment = {
      sandbox: config.sandbox,
      merchant_id: config.merchant_id,
      return_url: config.return_url,
      cancel_url: config.cancel_url,
      notify_url: config.notify_url,
      order_id: config.order_id,
      items: config.items,
      amount: config.amount,
      currency: config.currency,
      hash: config.hash,
      first_name: config.first_name,
      last_name: config.last_name,
      email: config.email,
      phone: config.phone,
      address: config.address,
      city: config.city,
      country: config.country,
    }

    window.payhere.onCompleted = function onCompleted(orderId: string) {
      console.log('Payment completed. OrderID:', orderId)
      router.push(`/payment/success?order_id=${orderId}`)
    }

    window.payhere.onDismissed = function onDismissed() {
      console.log('Payment dismissed')
      router.push('/payment/cancel')
    }

    window.payhere.onError = function onError(errorMsg: string) {
      console.error('Payment error:', errorMsg)
      setLocalError(`Payment failed: ${errorMsg}`)
    }

    window.payhere.startPayment(payment)
  }

  if (loading || localLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
        <p className="text-gray-600">Preparing secure payment gateway...</p>
      </div>
    )
  }

  if (error || localError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-bold text-red-800 mb-2">Payment Setup Failed</h2>
          <p className="text-red-600 mb-6">{error || localError}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready to Pay</h1>
          <p className="text-gray-600 mb-1">Order ID: {config?.order_id}</p>
          <p className="text-2xl font-bold text-teal-600 mb-4">LKR {config?.amount}</p>
          <p className="text-sm text-gray-500">{config?.items}</p>
        </div>

        <button
          onClick={initiatePayHerePayment}
          className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold mb-3"
        >
          Proceed to Payment
        </button>

        <button
          onClick={() => router.back()}
          className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
        >
          Cancel
        </button>

        <div className="mt-6 text-center text-xs text-gray-500">
          <svg className="w-4 h-4 text-green-600 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured by PayHere
        </div>
      </div>
    </div>
  )
}
