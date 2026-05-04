import React from 'react';
import { useSignedUrl, parseSupabaseUrl } from '../hooks/useSignedUrl';
import { Loader } from 'lucide-react';

export function SecureImage({ url, alt, className, ...props }) {
  const { bucket, path } = parseSupabaseUrl(url);
  const { signedUrl, loading, error } = useSignedUrl(bucket, path);

  if (!url) return null;
  
  // If it's a blob or data URL, just render it
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return <img src={url} alt={alt} className={className} {...props} />;
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 retro-border ${className}`}>
        <Loader size={16} className="animate-spin opacity-20" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`flex items-center justify-center bg-red-50 text-red-400 text-[8px] font-bold p-2 retro-border ${className}`}>
        Failed to load secure media
      </div>
    );
  }

  return <img src={signedUrl} alt={alt} className={className} {...props} />;
}

export function SecureAudio({ url, children }) {
  const { bucket, path } = parseSupabaseUrl(url);
  const { signedUrl, loading, error } = useSignedUrl(bucket, path);

  if (!url) return children(null);
  
  // If it's a blob or data URL, just return it
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return children(url);
  }

  if (loading) return <div className="animate-pulse opacity-50">...</div>;
  if (error) return <div className="text-[8px] text-red-500">Error</div>;

  return children(signedUrl);
}
