'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';

/**
 * `/` is always redirected by RouteGuard to the role home
 * (`/dashboard`, `/manager-dashboard`, or `/employee-dashboard`).
 * Do not render placeholder metrics here — they would flash fake data
 * before the redirect.
 */
const Home: React.FC = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
        <div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" />
        <span className="sr-only">Loading</span>
      </div>
    </Layout>
  );
};

export default Home;
