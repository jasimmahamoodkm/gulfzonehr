'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Eye, EyeOff, Lock } from 'lucide-react';

const changePasswordSchema = z
  .object({
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string(),
  })
  .refine(data => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordRequiredPage() {
  const router = useRouter();
  const { user, completePasswordChange } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setIsSubmitting(true);
      setMessage(null);

      await completePasswordChange(data.new_password);

      setMessage({
        type: 'success',
        text: 'Password changed successfully! Redirecting...',
      });

      reset();

      setTimeout(() => {
        router.push('/employee-dashboard');
      }, 1500);
    } catch (err) {
      const errMsg = (err as any)?.message || 'Failed to change password';
      console.error('Error changing password:', err);
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Page requires authentication
  if (!user) {
    return null;
  }

  // The useEffect above will handle redirecting if password is no longer temporary
  // But we allow rendering to show success message before redirect

  return (
    <Card className="shadow-lg">
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Lock size={32} className="text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Change Your Password</h1>
          <p className="text-gray-600">You must change your temporary password before you can access the system</p>
        </div>

        {/* Alert */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">⚠️ Important:</span> For security, you must set a new password. Choose a strong password that includes uppercase, lowercase, numbers, and special characters.
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New Password */}
          <div>
            <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                {...register('new_password')}
                id="new_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.new_password && (
              <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                {...register('confirm_password')}
                id="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmitting}
            className="w-full gap-2 py-3 text-base font-semibold"
          >
            {isSubmitting ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>

        {/* Password Requirements */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ At least 6 characters long</li>
            <li>✓ Mix of uppercase and lowercase letters</li>
            <li>✓ Include numbers and special characters for better security</li>
            <li>✓ Do not use common words or patterns</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
