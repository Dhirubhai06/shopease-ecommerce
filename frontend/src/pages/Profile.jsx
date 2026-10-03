import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AddressManager from "../components/AddressManager";
function Profile() {
    const BASE_URL = import.meta.env.VITE_DJANGO_BASE_URL || "";
    const { token, loginUser } = useAuth();

    const [profile, setProfile] = useState({ username: "", email: "", date_joined: "" });
    const [loading, setLoading] = useState(true);
    const [profileMsg, setProfileMsg] = useState(null);

    const [passwords, setPasswords] = useState({ old_password: "", new_password: "", confirm: "" });
    const [passwordMsg, setPasswordMsg] = useState(null);

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE_URL}/api/profile/`, {
            headers: { Authorization: `Token ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setProfile(data))
            .finally(() => setLoading(false));
    }, [BASE_URL, token]);

    const saveProfile = async (e) => {
        e.preventDefault();
        setProfileMsg(null);
        const response = await fetch(`${BASE_URL}/api/profile/`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${token}`,
            },
            body: JSON.stringify({ username: profile.username, email: profile.email }),
        });
        const data = await response.json();
        if (!response.ok) {
            setProfileMsg({ type: "error", text: data.error || "Unable to update profile" });
            return;
        }
        setProfile(data);
        loginUser(token, data.username); // navbar me naya username dikhe
        setProfileMsg({ type: "success", text: "Profile updated" });
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg(null);

        if (passwords.new_password !== passwords.confirm) {
            setPasswordMsg({ type: "error", text: "New passwords do not match" });
            return;
        }

        const response = await fetch(`${BASE_URL}/api/change-password/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${token}`,
            },
            body: JSON.stringify({
                old_password: passwords.old_password,
                new_password: passwords.new_password,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            setPasswordMsg({ type: "error", text: data.error || "Unable to change password" });
            return;
        }
        loginUser(data.token, profile.username); // naya token save karo
        setPasswords({ old_password: "", new_password: "", confirm: "" });
        setPasswordMsg({ type: "success", text: "Password changed successfully" });
    };

    const messageClass = (msg) =>
        msg.type === "error" ? "text-red-500 text-sm" : "text-green-600 text-sm";
    const inputClass = "mt-1 w-full rounded-md border border-gray-300 p-3";

    if (!token) return <Navigate to="/login" />;
    if (loading) return <p className="text-center mt-10">Loading...</p>;

    return (
        <div className="max-w-xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

            <form onSubmit={saveProfile} className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Account details</h2>

                <label className="block text-sm font-medium text-gray-700">
                    Username
                    <input
                        value={profile.username}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                        required
                        className={inputClass}
                    />
                </label>

                <label className="block text-sm font-medium text-gray-700">
                    Email
                    <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className={inputClass}
                    />
                </label>

                {profile.date_joined && (
                    <p className="text-sm text-gray-500">
                        Member since {new Date(profile.date_joined).toLocaleDateString()}
                    </p>
                )}

                {profileMsg && <p className={messageClass(profileMsg)}>{profileMsg.text}</p>}

                <button className="bg-gray-900 text-white px-5 py-2 rounded-lg">Save changes</button>
            </form>

            <form onSubmit={changePassword} className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Change password</h2>

                <label className="block text-sm font-medium text-gray-700">
                    Old password
                    <input
                        type="password"
                        value={passwords.old_password}
                        onChange={(e) => setPasswords({ ...passwords, old_password: e.target.value })}
                        required
                        className={inputClass}
                    />
                </label>

                <label className="block text-sm font-medium text-gray-700">
                    New password
                    <input
                        type="password"
                        value={passwords.new_password}
                        onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                        required
                        minLength={6}
                        className={inputClass}
                    />
                </label>

                <label className="block text-sm font-medium text-gray-700">
                    Confirm new password
                    <input
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        required
                        className={inputClass}
                    />
                </label>

                {passwordMsg && <p className={messageClass(passwordMsg)}>{passwordMsg.text}</p>}

                <button className="bg-gray-900 text-white px-5 py-2 rounded-lg">Update password</button>
            </form>
            <AddressManager />
        </div>
    );
}

export default Profile;