import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type ConnectStepStatus = 'pending' | 'active' | 'success' | 'error'

export type ConnectStep = {
  key: string
  title: string
  desc?: string
  status: ConnectStepStatus
}

const DeviceIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2H6C3.79086 2 2 3.79086 2 6V18C2 20.2091 3.79086 22 6 22H18C20.2091 22 22 20.2091 22 18V6C22 3.79086 20.2091 2 18 2ZM6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4ZM7 8C7 7.44772 7.44772 7 8 7H16C16.5523 7 17 7.44772 17 8V16C17 16.5523 16.5523 17 16 17H8C7.44772 17 7 16.5523 7 16V8ZM5 10C5.55228 10 6 10.4477 6 11V13C6 13.5523 5.55228 14 5 14C4.44772 14 4 13.5523 4 13V11C4 10.4477 4.44772 10 5 10ZM19 10C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14C18.4477 14 18 13.5523 18 13V11C18 10.4477 18.4477 10 19 10Z" />
</svg>
)

const ServerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 3C2.89543 3 2 3.89543 2 5V9C2 10.1046 2.89543 11 4 11H20C21.1046 11 22 10.1046 22 9V5C22 3.89543 21.1046 3 20 3H4ZM4 5H20V9H4V5ZM4 13C2.89543 13 2 13.8954 2 15V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V15C22 13.8954 21.1046 13 20 13H4ZM20 15V19H4V15H20ZM6 7H8V7.01H6V7ZM6 17H8V17.01H6V17Z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

export default function ConnectFlow({
  open,
  title,
  subtitle,
  steps,
  errorMessage,
  onCancel,
}: {
  open: boolean
  title: string
  subtitle?: string
  steps: ConnectStep[]
  errorMessage?: string
  onCancel?: () => void
}) {
  const currentStepIndex = steps.findIndex(s => s.status === 'active' || s.status === 'error')
  const activeIndex = currentStepIndex === -1 ? (steps.every(s => s.status === 'success') ? steps.length - 1 : 0) : currentStepIndex
  const isError = steps.some(s => s.status === 'error')
  const isAllSuccess = steps.every(s => s.status === 'success')

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-[min(90vw,500px)] bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 relative"
          >
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className={`absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br ${isError ? 'from-red-900/20' : isAllSuccess ? 'from-emerald-900/20' : 'from-blue-900/20'} to-transparent opacity-50 blur-3xl`} />
            </div>

            {/* Header */}
            <div className="z-10 text-center mb-8">
              <h2 className="text-2xl font-bold mb-1">{title}</h2>
              {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
            </div>

            {/* Visual Flow Area (Top) */}
            <div className="z-10 w-full flex items-center justify-between px-4 mb-8 relative h-20">
              
              {/* Left: Device */}
              <div className="flex flex-col items-center gap-2 relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isError ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-white'}`}>
                   <DeviceIcon className="w-8 h-8" />
                </div>
              </div>

              {/* Middle: Connection Line */}
              <div className="flex-1 mx-4 h-[2px] bg-slate-700 relative overflow-hidden rounded-full">
                {/* Flow Animation */}
                {!isError && !isAllSuccess && (
                  <motion.div 
                    className="absolute inset-0 bg-blue-500 w-1/3 rounded-full blur-[1px]"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                )}
                {isAllSuccess && (
                   <motion.div 
                    className="absolute inset-0 bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                   />
                )}
                 {isError && (
                   <div className="absolute inset-0 bg-red-900/50" />
                )}
              </div>

               {/* Right: Server */}
               <div className="flex flex-col items-center gap-2 relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isAllSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : isError ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-800 text-slate-500'}`}>
                  {isError ? (
                    <ErrorIcon className="w-7 h-7" />
                  ) : isAllSuccess ? (
                    <CheckIcon className="w-7 h-7" />
                  ) : (
                    <ServerIcon className="w-8 h-8" />
                  )}
                </div>
              </div>
            </div>

            {/* Step List Area (Switch Style) */}
            <div className="z-10 w-full space-y-3 mb-6">
              {steps.map((step, idx) => (
                <div key={step.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${step.status === 'active' ? 'text-white' : step.status === 'success' ? 'text-emerald-400' : step.status === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
                      {step.title}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {step.status === 'active' && (
                      <SpinnerIcon className="w-5 h-5 text-blue-400" />
                    )}
                    {step.status === 'success' && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    )}
                    {step.status === 'error' && (
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                         <span className="text-red-400 font-bold text-xs">!</span>
                      </div>
                    )}
                     {step.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-700" />
                    )}
                  </div>
                </div>
              ))}
            </div>

             {/* Error Message */}
             {isError && errorMessage && (
                <div className="z-10 w-full mb-6 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-center">
                    <div className="text-red-300 text-sm font-medium">{errorMessage}</div>
                </div>
             )}

            {/* Footer / Buttons */}
            <div className="z-10 w-full flex justify-center mt-auto">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className={`
                    px-6 py-2.5 rounded-xl font-bold text-sm transition-all
                    ${isError 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white w-full' 
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {isError ? '关闭' : '取消连接'}
                </button>
              )}
               {!onCancel && isError && (
                 <button
                    onClick={() => window.location.reload()}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm w-full transition-all"
                 >
                   刷新页面
                 </button>
               )}
            </div>

          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
