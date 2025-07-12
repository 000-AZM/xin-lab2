import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBoO7_HaCFzzEjm8G_F5O4uYf2_9O-tnik",
  authDomain: "tele-bot-xinn.firebaseapp.com",
  databaseURL: "https://tele-bot-xinn-default-rtdb.firebaseio.com",
  projectId: "tele-bot-xinn",
  storageBucket: "tele-bot-xinn.firebasestorage.app",
  messagingSenderId: "223868480659",
  appId: "1:223868480659:web:e57ebf544d55f2c8873166",
  measurementId: "G-CPGFR2DY8S"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.checkAuthAndRedirect = function (currentPage) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
    }
  });
};

window.register = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email.endsWith("@xinn.lab")) {
    alert("Only @xinn.lab emails allowed.");
    return;
  }
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCred.user.uid), { name: email, email });
    window.location.href = "feed.html";
  } catch (e) {
    alert(e.message);
  }
};

window.login = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email.endsWith("@xinn.lab")) {
    alert("Only @xinn.lab emails allowed.");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "feed.html";
  } catch (e) {
    alert(e.message);
  }
};

window.logout = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};

// Profile page
window.loadProfile = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const docSnap = await getDoc(doc(db, "users", user.uid));
  const data = docSnap.data() || {};
  document.getElementById("profile-name").value = data.name || "";
  document.getElementById("profile-bio").value = data.bio || "";
  document.getElementById("user-pic").src = data.photoURL || "https://via.placeholder.com/40";
};

window.uploadProfilePic = async () => {
  const file = document.getElementById("profile-pic").files[0];
  if (!file) return;
  const storageRef = ref(storage, "avatars/" + auth.currentUser.uid);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, "users", auth.currentUser.uid), { photoURL: url }, { merge: true });
  document.getElementById("user-pic").src = url;
};

window.updateProfile = async () => {
  const name = document.getElementById("profile-name").value.trim();
  const bio = document.getElementById("profile-bio").value.trim();
  await setDoc(doc(db, "users", auth.currentUser.uid), { name, bio }, { merge: true });
  alert("Profile updated");
};

// Feed page
window.createPost = async () => {
  const content = document.getElementById("postContent").value.trim();
  if (!content) return alert("Post cannot be empty");
  await addDoc(collection(db, "posts"), {
    userId: auth.currentUser.uid,
    content,
    timestamp: Date.now(),
  });
  document.getElementById("postContent").value = "";
};

window.loadPosts = () => {
  const postsDiv = document.getElementById("posts");
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
  onSnapshot(q, async (snapshot) => {
    postsDiv.innerHTML = "";
    for (let docSnap of snapshot.docs) {
      const post = docSnap.data();
      const userRef = await getDoc(doc(db, "users", post.userId));
      const userData = userRef.data() || {};
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="flex-row">
          <img class="user-pic" src="${userData.photoURL || ''}" />
          <strong>${userData.name || 'User'}</strong>
        </div>
        <p>${post.content}</p>
        <button onclick="likePost('${docSnap.id}')">❤️ Like</button>
        <span id="like-count-${docSnap.id}">0</span> likes
        <div>
          <input placeholder="Add comment..." onkeypress="if(event.key==='Enter'){ addComment('${docSnap.id}', this.value); this.value=''; }" />
          <div id="comments-${docSnap.id}"></div>
        </div>
      `;
      postsDiv.appendChild(div);
      loadComments(docSnap.id);
      loadLikes(docSnap.id);
    }
  });
};

window.likePost = async (postId) => {
  await setDoc(doc(db, "posts", postId, "likes", auth.currentUser.uid), {
    userId: auth.currentUser.uid,
  });
};

function loadLikes(postId) {
  const q = collection(db, "posts", postId, "likes");
  onSnapshot(q, (snap) => {
    const el = document.getElementById(`like-count-${postId}`);
    if (el) el.textContent = snap.size;
  });
}

window.addComment = async (postId, comment) => {
  if (!comment.trim()) return;
  await addDoc(collection(db, "posts", postId, "comments"), {
    text: comment,
    userId: auth.currentUser.uid,
    time: Date.now(),
  });
};

function loadComments(postId) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("time"));
  onSnapshot(q, async (snap) => {
    const div = document.getElementById(`comments-${postId}`);
    if (!div) return;
    div.innerHTML = "";
    for (let docSnap of snap.docs) {
      const c = docSnap.data();
      const u = await getDoc(doc(db, "users", c.userId));
      const user = u.data() || {};
      const p = document.createElement("div");
      p.className = "comment";
      p.innerHTML = `<b>${user.name || "User"}:</b> ${c.text}`;
      div.appendChild(p);
    }
  });
}

// Friend system
window.sendFriendRequest = async () => {
  const toEmail = document.getElementById("friend-email").value.trim();
  if (!toEmail.endsWith("@xinn.lab")) {
    alert("Friend email must end with @xinn.lab");
    return;
  }
  const usersCol = collection(db, "users");
  const q = query(usersCol, where("email", "==", toEmail));
  const snap = await getDocs(q);
  if (snap.empty) return alert("User not found");
  const toId = snap.docs[0].id;

  const reqId = `${auth.currentUser.uid}_${toId}`;
  const reqDoc = await getDoc(doc(db, "friend_requests", reqId));
  if (reqDoc.exists()) return alert("Request already sent or you are friends");

  await setDoc(doc(db, "friend_requests", reqId), {
    from: auth.currentUser.uid,
    to: toId,
    status: "pending",
  });
  alert("Request sent");
};

window.loadFriendRequests = () => {
  const q = query(collection(db, "friend_requests"), where("to", "==", auth.currentUser.uid));
  onSnapshot(q, (snap) => {
    const container = document.getElementById("friend-requests");
    if (!container) return;
    container.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.status === "pending") {
        const el = document.createElement("div");
        el.innerHTML = `
              Request from ${d.from}
              <button onclick="acceptFriend('${d.from}')">Accept</button>
              <button onclick="rejectFriend('${docSnap.id}')">Reject</button>
            `;
        container.appendChild(el);
      }
    });
  });
};

window.acceptFriend = async (friendId) => {
  const reqId = `${friendId}_${auth.currentUser.uid}`;
  await setDoc(doc(db, "friend_requests", reqId), { status: "accepted" }, { merge: true });
  await setDoc(doc(db, "friends", `${auth.currentUser.uid}_${friendId}`), {
    a: auth.currentUser.uid,
    b: friendId,
  });
  await setDoc(doc(db, "friends", `${friendId}_${auth.currentUser.uid}`), {
    a: friendId,
    b: auth.currentUser.uid,
  });
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
    if (!container) return;
    container.innerHTML = "";
    for (let docSnap of snap.docs) {
      const f = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", f.b));
      const userData = userSnap.data() || {};
      const el = document.createElement("div");
      el.textContent = userData.name || f.b;
      container.appendChild(el);
    }
  });
};

// Chat system
window.loadFriendsForChat = () => {
  const select = document.getElementById("chat-users");
  if (!select) return;
  const q = query(collection(db, "friends"), where("a", "==", auth.currentUser.uid));
  onSnapshot(q, async (snap) => {
    select.innerHTML = '<option value="">Select Friend</option>';
    for (let docSnap of snap.docs) {
      const f = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", f.b));
      const userData = userSnap.data() || {};
      const opt = document.createElement("option");
      opt.value = f.b;
      opt.text = userData.name || f.b;
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
    time: Date.now(),
  });
  document.getElementById("chat-msg").value = "";
};

window.loadMessages = (friendId) => {
  if (!friendId) {
    document.getElementById("chat-messages").innerHTML = "";
    return;
  }
  const q = query(collection(db, "messages"), orderBy("time"));
  onSnapshot(q, (snap) => {
    const div = document.getElementById("chat-messages");
    if (!div) return;
    div.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (
        (d.from === auth.currentUser.uid && d.to === friendId) ||
        (d.to === auth.currentUser.uid && d.from === friendId)
      ) {
        const p = document.createElement("p");
        p.textContent = `${d.from === auth.currentUser.uid ? "You" : d.from}: ${d.msg}`;
        div.appendChild(p);
      }
    });
  });
};

// Search users
window.searchUsers = async (term) => {
  const container = document.getElementById("search-results");
  if (!container) return;
  container.innerHTML = "";
  if (!term.trim()) return;
  const q = query(collection(db, "users"));
  const snap = await getDocs(q);
  snap.forEach((docSnap) => {
    const u = docSnap.data();
    if (u.name && u.name.toLowerCase().includes(term.toLowerCase())) {
      const div = document.createElement("div");
      div.textContent = u.name + (u.email ? ` (${u.email})` : "");
      container.appendChild(div);
    }
  });
};

window.loadProfile = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const docSnap = await getDoc(doc(db, "users", user.uid));
  const data = docSnap.data() || {};

  document.getElementById("profile-name").value = data.name || "";
  document.getElementById("profile-bio").value = data.bio || "";
  document.getElementById("user-pic").src = data.photoURL || "https://via.placeholder.com/80";
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
