"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import Image from 'next/image';
import { auth } from "../../firebase/initFirebase";
import { useRouter } from 'next/navigation';
import { signOut } from "firebase/auth";
import { getIdToken } from 'firebase/auth';

interface DroneItem {
  id: number;
  timestamp: string;
  type: string;
  color: string;
  size: 'Small' | 'Medium' | 'Large' | 'XLarge';
  location: string;
  confidence: number;
  imageUrl: string;
}

const mockItems: DroneItem[] = [
  {
    id: 1,
    timestamp: "2024-01-24 10:30",
    type: "Vehicle",
    color: "Red",
    size: "Large",
    location: "North Parking",
    confidence: 0.95,
    imageUrl: "/placeholder.jpg"
  },
  {
    id: 2,
    timestamp: "2024-01-24 10:31",
    type: "Building",
    color: "Gray",
    size: "XLarge",
    location: "Central Area",
    confidence: 0.98,
    imageUrl: "/placeholder.jpg"
  },
  {
    id: 3,
    timestamp: "2024-01-24 10:32",
    type: "Person",
    color: "Blue",
    size: "Small",
    location: "South Entrance",
    confidence: 0.89,
    imageUrl: "/placeholder.jpg"
  }
];

interface Photo {
  id: string;
  url: string;
}

export default function DroneAnalysisPage() {
  const router = useRouter();
  const [user, setUser] = useState(auth.currentUser);
  const [items, setItems] = useState<DroneItem[]>(mockItems);
  const [selectedItem, setSelectedItem] = useState<DroneItem | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof DroneItem;
    direction: 'asc' | 'desc';
  }>({ key: 'timestamp', direction: 'asc' });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleSort = (key: keyof DroneItem) => {
    const direction = 
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sortedItems = [...items].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setItems(sortedItems);
  };

  const getSortIcon = (key: keyof DroneItem) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="w-4 h-4" /> : 
        <ChevronDown className="w-4 h-4" />;
    }
    return null;
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const idToken = await getIdToken(user);
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Refresh the photos list
      fetchPhotos();
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  const fetchPhotos = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const idToken = await getIdToken(user);
      const response = await fetch('/api/photos', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const data = await response.json();
      setPhotos(data);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPhotos();
    }
  }, [user, fetchPhotos]);

  if (!user) {
    return null; // or a loading spinner
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Hi, {user.displayName}</h1>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="w-5 h-5" />
              Detected Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th 
                      className="p-2 text-left cursor-pointer"
                      onClick={() => handleSort('timestamp')}
                    >
                      Time {getSortIcon('timestamp')}
                    </th>
                    <th 
                      className="p-2 text-left cursor-pointer"
                      onClick={() => handleSort('type')}
                    >
                      Type {getSortIcon('type')}
                    </th>
                    <th 
                      className="p-2 text-left cursor-pointer"
                      onClick={() => handleSort('confidence')}
                    >
                      Confidence {getSortIcon('confidence')}
                    </th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.timestamp}</td>
                      <td className="p-2">{item.type}</td>
                      <td className="p-2">{(item.confidence * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <ImageIcon className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Image Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItem ? (
              <div>
                <Image
                  src={selectedItem.imageUrl}
                  alt={`Drone photo of ${selectedItem.type}`}
                  width={500} // Adjust this value as needed
                  height={300} // Adjust this value as needed
                  className="w-full rounded-lg shadow-lg"
                />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold">Type:</p>
                    <p>{selectedItem.type}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Color:</p>
                    <p>{selectedItem.color}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Size:</p>
                    <p>{selectedItem.size}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Location:</p>
                    <p>{selectedItem.location}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select an item from the list to view its image
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              User Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {uploading && <p>Uploading...</p>}
            <div className="grid grid-cols-3 gap-4 mt-4">
              {photos.map((photo) => (
                <Image
                  key={photo.id}
                  src={photo.url}
                  alt="User uploaded photo"
                  width={100}
                  height={100}
                  className="rounded-lg"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
