import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, hint, id, className = '', ...rest }) => {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="label-text">
        {label}
      </label>
      <input
        id={inputId}
        className={`input-field ${error ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-100' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-surface-500">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
};
