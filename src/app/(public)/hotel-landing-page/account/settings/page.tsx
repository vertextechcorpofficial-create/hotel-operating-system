"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Lock, Camera, Upload } from "lucide-react";

const ID_TYPES = [
  "Philippine Identification Card (PhilID)",
  "Passport",
  "Driver's License",
  "SSS ID",
  "GSIS ID",
  "UMID",
  "PRC ID",
  "Voter's ID",
  "Postal ID",
  "Other"
];

export default function AccountSettingsPage() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    contact_number: "",
    id_type: "",
    id_number: "",
    id_photo_uuid: "",
    profile_picture: "",
  });
  
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const idPhotoInputRef = useRef<HTMLInputElement>(null);

  const directusUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  useEffect(() => {
    // Fetch initial user data from auth/me
    fetch("/api/hotel-landing-page/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setProfileData({
            username: data.user.username || "",
            email: data.user.email || "",
            contact_number: data.user.contact_number || "",
            id_type: data.user.id_type || "",
            id_number: data.user.id_number || "",
            id_photo_uuid: data.user.id_photo_uuid || "",
            profile_picture: data.user.profile_picture || "",
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "profile_picture" | "id_photo_uuid") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fieldName === "profile_picture") setUploadingPic(true);
    else setUploadingId(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Proxy the upload through our own API to avoid CORS issues
      const res = await fetch("/api/hotel-landing-page/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload file");

      const fileId = data.id;
      setProfileData(prev => ({ ...prev, [fieldName]: fileId }));

      setProfileMsg({ type: "success", text: "File uploaded successfully! Don't forget to save changes." });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: `Upload failed: ${err.message}` });
    } finally {
      if (fieldName === "profile_picture") setUploadingPic(false);
      else setUploadingId(false);
      
      // Reset input
      if (e.target) e.target.value = "";
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/hotel-landing-page/user/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg({ type: "", text: "" });

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMsg({ type: "error", text: "New passwords do not match" });
      setSavingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/hotel-landing-page/user/password/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setPasswordMsg({ type: "success", text: "Password updated successfully!" });
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="p-8 text-neutral-500">Loading settings...</div>;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Profile Details Section */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-neutral-900">Profile Details</h2>
          <p className="text-sm text-neutral-500 mt-1">Update your personal information and valid ID.</p>
        </div>

        {profileMsg.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm border ${
            profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileUpdate} className="flex flex-col gap-6 max-w-2xl">
          
          {/* Profile Picture Upload */}
          <div className="flex items-center gap-6 mb-2">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center group shrink-0">
              {profileData.profile_picture ? (
                <img 
                  src={`${directusUrl}/assets/${profileData.profile_picture}?width=200&height=200&fit=cover`} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl text-neutral-400 font-semibold">
                  {profileData.username ? profileData.username.charAt(0).toUpperCase() : "U"}
                </span>
              )}
              
              <div 
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => profilePicInputRef.current?.click()}
              >
                <Camera size={24} className="text-white" />
              </div>
              <input 
                type="file" 
                ref={profilePicInputRef}
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "profile_picture")}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Profile Picture</h3>
              <p className="text-xs text-neutral-500 mt-1 mb-3">Click the avatar to upload a new photo. Max size 5MB.</p>
              {uploadingPic && <span className="text-xs text-[#8B5CF6] font-medium animate-pulse">Uploading...</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">Username</label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">Email Address</label>
              <input
                type="email"
                required
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-700">Contact Number</label>
            <input
              type="text"
              value={profileData.contact_number}
              onChange={(e) => setProfileData({ ...profileData, contact_number: e.target.value })}
              className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">ID Type</label>
              <select
                value={profileData.id_type}
                onChange={(e) => setProfileData({ ...profileData, id_type: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all bg-white"
              >
                <option value="">Select ID Type...</option>
                {ID_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">Valid ID Number</label>
              <input
                type="text"
                required
                value={profileData.id_number}
                onChange={(e) => setProfileData({ ...profileData, id_number: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-700">Valid ID Photo</label>
            <div className="flex items-center gap-4 mt-1">
              <button
                type="button"
                onClick={() => idPhotoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 bg-neutral-50 text-neutral-700 rounded-xl text-sm font-medium hover:bg-neutral-100 transition-colors"
              >
                <Upload size={16} />
                Upload ID Photo
              </button>
              <input 
                type="file" 
                ref={idPhotoInputRef}
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "id_photo_uuid")}
              />
              {uploadingId && <span className="text-sm text-[#8B5CF6] animate-pulse">Uploading...</span>}
              {!uploadingId && profileData.id_photo_uuid && (
                <span className="text-sm text-green-600 font-medium">✓ Photo uploaded</span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Please ensure the ID is clear and readable.</p>
          </div>

          <hr className="border-neutral-100 my-2" />

          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-70"
          >
            <Save size={16} />
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Security Section */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-neutral-900">Security</h2>
          <p className="text-sm text-neutral-500 mt-1">Update your password to keep your account secure.</p>
        </div>

        {passwordMsg.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm border ${
            passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-5 max-w-xl">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-700">Current Password</label>
            <input
              type="password"
              required
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">New Password</label>
              <input
                type="password"
                required
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-700">Confirm New Password</label>
              <input
                type="password"
                required
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="mt-2 flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-xl text-sm font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-70"
          >
            <Lock size={16} />
            {savingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>

    </div>
  );
}
