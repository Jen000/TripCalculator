'use client';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type PasswordInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
};

const PasswordInput = ({ value, onChange, placeholder }: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Password"}
        className="w-full border-2 rounded-md px-3 py-2 pr-10 text-right outline-none focus:border-blue-700"
      />
      <div
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 cursor-pointer"
        onClick={() => setIsVisible((prev) => !prev)}
      >
        {isVisible ? <Eye size={22} /> : <EyeOff size={22} />}
      </div>
    </div>
  );
};

export default PasswordInput;