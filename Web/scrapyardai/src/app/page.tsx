"use client";

import React, { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/initFirebase";
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const LandingPageClient = dynamic(() => Promise.resolve(LandingPage), { ssr: false });

function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        router.push('/drone-analysis');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/drone-analysis');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDashboardNavigation = () => {
    router.push('/drone-analysis');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section */}
      <section className="bg-blue-600 text-white text-center py-20">
        <h1 className="text-4xl font-bold">Drone Image Analysis System</h1>
        <p className="mt-4 text-lg">Capture, Process, and Analyze Drone Images with Ease</p>
        <div className="mt-8 space-x-4">
          <button
            className="px-6 py-3 bg-white text-blue-600 rounded-full"
            onClick={handleGoogleSignIn}
          >
            Sign In with Google
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold">Features</h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">Image Processing</h3>
              <p className="mt-2">Process images with custom filters and metadata analysis.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">Token-Based System</h3>
              <p className="mt-2">Flexible pricing with high-speed and low-speed token options.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">Cloud Storage</h3>
              <p className="mt-2">Securely store and access your data on the cloud.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-6">
        <p>&copy; 2023 Drone Image Analysis System. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPageClient;
