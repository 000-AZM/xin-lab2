// app.js
import { auth, db, storage } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
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
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const authSection = document.getElementById('auth-section');
const userSection = document.getElementById('user-section');
const userNameSpan = document.getElementById('user-name');
const userPic = document.getElementById('user-pic');
const postsDiv = document.getElementById('posts');

// Show/hide sections
window.showSection = function (id) {
  document.querySelectorAll('.section').forEach((div) => div.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.style.display = 'none';
    userSection.style.display = 'block';

    // Load profile info
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    const data = profileSnap.data() || {};
    userNameSpan.textContent = data.name || user.email;
    userPic.src = data.photoURL || 'https://via.placeholder.com/32';
    document.getElementById('profile-name').value = data.name || '';
    document.getElementById('profile-bio').value = data.bio || '';

    // Load posts & friends & friend requests & chats
    loadPosts();
    loadFriendRequests();
    loadFriendsForChat();

    showSection('feed');
  } else {
    authSection.style.display = 'block';
    userSection.style.display = 'none';
  }
});

// Register with @xinn.lab email restriction
window.register = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email.endsWith('@xinn.lab')) {
    alert('Only @xinn.lab email addresses are allowed.');
    return;
  }
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', userCred.user.uid), { name: email, email });
};

// Login with @xinn.lab email restriction
window.login = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email.endsWith('@xinn.lab')) {
    alert('Only @xinn.lab email addresses are allowed.');
    return;
  }
  await signInWithEmailAndPassword(auth, email, password);
};

window.logout = async () => {
  await signOut(auth);
};

// Profile picture upload
window.uploadProfilePic = async () => {
  const file = document.getElementById('profile-pic').files[0];
  if (!file) return;
  const storageRef = ref(storage, 'avatars/' + auth.currentUser.uid);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: url }, { merge: true });
  userPic.src = url;
};

// Update profile (name, bio)
window.updateProfile = async () => {
  const name = document.getElementById('profile-name').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  await setDoc(doc(db, 'users', auth.currentUser.uid), { name, bio }, { merge: true });
  alert('Profile updated!');
  userNameSpan.textContent = name || auth.currentUser.email;
};

// Create post
window.createPost = async () => {
  const content = document.getElementById('postContent').value.trim();
  if (!content) return;
  await addDoc(collection(db, 'posts'), {
    userId: auth.currentUser.uid,
    content,
    timestamp: Date.now(),
  });
  document.getElementById('postContent').value = '';
};

// Load posts with likes and comments
function loadPosts() {
  const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
  onSnapshot(q, async (snapshot) => {
    postsDiv.innerHTML = '';
    for (let docSnap of snapshot.docs) {
      const post = docSnap.data();
      const userRef = await getDoc(doc(db, 'users', post.userId));
      const userData = userRef.data() || {};
      const div = document.createElement('div');
      div.className = 'post';
      div.innerHTML = `
        <div><img class="user-pic" src="${userData.photoURL || ''}" />${userData.name || 'User'}</div>
        <div>${post.content}</div>
        <div>
          <button onclick="likePost('${docSnap.id}')">❤️ Like</button>
          <span id="like-count-${docSnap.id}">0</span> likes
        </div>
        <div class="comment-input">
          <input placeholder="Add comment..." onkeypress="if(event.key==='Enter'){ addComment('${docSnap.id}', this.value); this.value=''; }" />
        </div>
        <div id="comments-${docSnap.id}"></div>
      `;
      postsDiv.appendChild(div);
      loadComments(docSnap.id);
      loadLikes(docSnap.id);
    }
  });
}

// Likes
window.likePost = async (postId) => {
  await setDoc(doc(db, 'posts', postId, 'likes', auth.currentUser.uid), {
    userId: auth.currentUser.uid,
  });
};

function loadLikes(postId) {
  const q = collection(db, 'posts', postId, 'likes');
  onSnapshot(q, (snap) => {
    document.getElementById(`like-count-${postId}`).textContent = snap.size;
  });
}

// Comments
window.addComment = async (postId, comment) => {
  if (!comment.trim()) return;
  await addDoc(collection(db, 'posts', postId, 'comments'), {
    text: comment,
    userId: auth.currentUser.uid,
    time: Date.now(),
  });
};

function loadComments(postId) {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('time'));
  onSnapshot(q, async (snap) => {
    const div = document.getElementById(`comments-${postId}`);
    div.innerHTML = '';
    for (let docSnap of snap.docs) {
      const c = docSnap.data();
      const u = await getDoc(doc(db, 'users', c.userId));
      const user = u.data() || {};
      const p = document.createElement('div');
      p.className = 'comment';
      p.innerHTML = `<b>${user.name || 'User'}:</b> ${c.text}`;
      div.appendChild(p);
    }
  });
}

// Friend system

//
