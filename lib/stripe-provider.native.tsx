import React from 'react';

let RealStripeProvider: any = null;
try {
  RealStripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch {}

export function StripeProvider({ children, ...props }: any) {
  if (RealStripeProvider) {
    return <RealStripeProvider {...props}>{children}</RealStripeProvider>;
  }
  return <>{children}</>;
}
