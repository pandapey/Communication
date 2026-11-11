import { useState } from 'react';

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  autoComplete = 'current-password',
  className = '',
  inputClassName = '',
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full border rounded-lg p-2.5 pr-11 bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 ${inputClassName}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none px-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
