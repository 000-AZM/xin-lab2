// Firebase config
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, collection, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Firebase Init
const firebaseConfig = {
  apiKey: "AIzaSyBoO7_HaCFzzEjm8G_F5O4uYf2_9O-tnik",
  authDomain: "tele-bot-xinn.firebaseapp.com",
  databaseURL: "https://tele-bot-xinn-default-rtdb.firebaseio.com",
  projectId: "tele-bot-xinn",
  storageBucket: "tele-bot-xinn.appspot.com",
  messagingSenderId: "223868480659",
  appId: "1:223868480659:web:e57ebf544d55f2c8873166",
  measurementId: "G-CPGFR2DY8S"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enforce @xinn.lab email
function isValidEmail(email) {
  return email.endsWith("@xinn.lab");
}

// Auth Functions
window.register = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!isValidEmail(email)) return alert("Use a @xinn.lab email.");

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      name: email.split("@")[0],
      photoURL: ""
    });
    location.href = "feed.html";
  } catch (err) {
    alert(err.message);
  }
};

window.login = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!isValidEmail(email)) return alert("Use a @xinn.lab email.");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    location.href = "feed.html";
  } catch (err) {
    alert(err.message);
  }
};

window.logout = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// Ensure login
window.checkAuthAndRedirect = (page) => {
  onAuthStateChanged(auth, (user) => {
    if (!user) location.href = "index.html";
  });
};

// Profile
window.loadProfile = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const docSnap = await getDoc(doc(db, "users", user.uid));
  const data = docSnap.data() || {};

  document.getElementById("profile-name").value = data.name || "";
  document.getElementById("profile-bio").value = data.bio || "";
  document.getElementById("user-pic").src = data.photoURL || "https://via.placeholder.com/120";
};

window.uploadProfilePic = async () => {
  const file = document.getElementById("profile-pic").files[0];
  if (!file) return;

  const storageRef = ref(storage, "avatars/" + auth.currentUser.uid);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await setDoc(doc(db, "users", auth.currentUser.uid), {
    photoURL: url
  }, { merge: true });

  document.getElementById("user-pic").src = url;
  alert("Profile picture updated");
};

window.updateProfile = async () => {
  const name = document.getElementById("profile-name").value.trim();
  const bio = document.getElementById("profile-bio").value.trim();

  await setDoc(doc(db, "users", auth.currentUser.uid), {
    name,
    bio
  }, { merge: true });

  alert("Profile updated successfully!");
};

// Friend system
window.sendFriendRequest = async () => {
  const toEmail = document.getElementById("friend-email").value.trim();
  if (!isValidEmail(toEmail)) return alert("Must be a @xinn.lab email");

  const q = query(collection(db, "users"), where("email", "==", toEmail));
  const snap = await getDocs(q);
  if (snap.empty) return alert("User not found");

  const toId = snap.docs[0].id;
  const reqId = `${auth.currentUser.uid}_${toId}`;
  const existing = await getDoc(doc(db, "friend_requests", reqId));
  if (existing.exists()) return alert("Request already sent");

  await setDoc(doc(db, "friend_requests", reqId), {
    from: auth.currentUser.uid,
    to: toId,
    status: "pending"
  });
  alert("Request sent!");
};

window.loadFriendRequests = () => {
  const q = query(collection(db, "friend_requests"), where("to", "==", auth.currentUser.uid));
  onSnapshot(q, async (snap) => {
    const container = document.getElementById("friend-requests");
    container.innerHTML = "";
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (d.status === "pending") {
        const userDoc = await getDoc(doc(db, "users", d.from));
        const name = userDoc.data()?.name || "Unknown";
        const el = document.createElement("div");
        el.className = "friend-box";
        el.innerHTML = `
          <strong>${name}</strong> wants to be friends<br/>
          <button onclick="acceptFriend('${d.from}')">Accept</button>
          <button onclick="rejectFriend('${docSnap.id}')">Reject</button>
        `;
        container.appendChild(el);
      }
    }
  });
};

window.acceptFriend = async (friendId) => {
  const reqId = `${friendId}_${auth.currentUser.uid}`;
  await setDoc(doc(db, "friend_requests", reqId), { status: "accepted" }, { merge: true });
  await setDoc(doc(db, "friends", `${auth.currentUser.uid}_${friendId}`), { a: auth.currentUser.uid, b: friendId });
  await setDoc(doc(db, "friends", `${friendId}_${auth.currentUser.uid}`), { a: friendId, b: auth.currentUser.uid });
  alert("Friend added");
};

window.rejectFriend = async (reqId) => {
  await setDoc(doc(db, "friend_requests", reqId), { status: "rejected" }, { merge: true });
  alert("Request rejected");
};

window.loadFriendsList = () => {
  const q = query(collection(db, "friends"), where("a", "==", auth.currentUser.uid));
  onSnapshot(q, async (snap) => {
    const container = document.getElementById("friend-list");
    container.innerHTML = "";
    for (const docSnap of snap.docs) {
      const f = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", f.b));
      const name = userSnap.data()?.name || f.b;
      const el = document.createElement("div");
      el.className = "friend-box";
      el.innerHTML = `<strong>${name}</strong>`;
      container.appendChild(el);
    }
  });
};

// Chat
window.loadFriendsForChat = () => {
  const select = document.getElementById("chat-users");
  const q = query(collection(db, "friends"), where("a", "==", auth.currentUser.uid));
  onSnapshot(q, async (snap) => {
    select.innerHTML = '<option value="">-- Select Friend --</option>';
    for (const docSnap of snap.docs) {
      const f = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", f.b));
      const name = userSnap.data()?.name || f.b;
      const opt = document.createElement("option");
      opt.value = f.b;
      opt.textContent = name;
      select.appendChild(opt);
    }
  });
};

window.sendMessage = async () => {
  const to = document.getElementById("chat-users").value;
  const msg = document.getElementById("chat-msg").value.trim();
  if (!to || !msg) return;

  await addDoc(collection(db, "messages"), {
    from: auth.currentUser.uid,
    to,
    msg,
    time: Date.now()
  });
  document.getElementById("chat-msg").value = "";
};

window.loadMessages = (friendId) => {
  const div = document.getElementById("chat-messages");
  if (!friendId) return (div.innerHTML = "");

  const q = query(collection(db, "messages"), orderBy("time"));
  onSnapshot(q, (snap) => {
    div.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const isChat =
        (d.from === auth.currentUser.uid && d.to === friendId) ||
        (d.to === auth.currentUser.uid && d.from === friendId);

      if (isChat) {
        const p = document.createElement("div");
        p.className = "chat-line " + (d.from === auth.currentUser.uid ? "you" : "");
        p.textContent = `${d.from === auth.currentUser.uid ? "You" : "Friend"}: ${d.msg}`;
        div.appendChild(p);
      }
    });
  });
};
