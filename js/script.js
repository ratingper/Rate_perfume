import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification, 
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDuM804L-1zEvcP8i0KiNYU2vXaLSbW3nc",
    authDomain: "perfume-rating.firebaseapp.com",
    projectId: "perfume-rating",
    storageBucket: "perfume-rating.appspot.com",
    messagingSenderId: "1037621518138",
    appId: "1:1037621518138:web:13302a5e55930a46c6ba03",
    measurementId: "G-3NCT4SYQ8Q"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CLOUDINARY CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = 'djb6fug6g';
const CLOUDINARY_UPLOAD_PRESET = 'bco4tza2';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// --- Admin User ID ---
const ADMIN_UID = 'WJD0saAt2gWbFavVuAMAQHxqpxX2';

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & UI ELEMENTS ---
    const state = { user: null, category: null, rating: 0, selectedPerfume: null };
    const userInfoDiv = document.getElementById('user-info');
    const verificationNotice = document.getElementById('email-verification-notice');
    const adminLinkContainer = document.getElementById('admin-link-container');

    // --- MESSAGE DISPLAY FUNCTION ---
    function showMessage(page, message, isError = false) {
        const pageMap = {
            '#question': 'question-message',
            '#review': 'review-message',
            '#main': 'main-message',
            '#admin': 'admin-message',
            '#my-reviews': 'my-reviews-message'
        };
        const messageDiv = document.getElementById(pageMap[page]);
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = isError ? 'error' : 'success';
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
                messageDiv.textContent = '';
                messageDiv.className = '';
            }, 5000);
        }
    }

    // --- AUTHENTICATION ---
    onAuthStateChanged(auth, (user) => {
        adminLinkContainer.innerHTML = '';
        if (user) {
            state.user = {
                id: user.uid,
                name: user.displayName,
                email: user.email,
                picture: user.photoURL,
                emailVerified: user.emailVerified
            };
            updateUserInfoUI();

            const currentHash = window.location.hash.split('?')[0];
            if (state.user.id === ADMIN_UID) {
                adminLinkContainer.innerHTML = `<a href="#admin" class="text-link">Admin Panel</a>`;
                if (window.location.hash !== '#admin' && window.location.hash !== '') {
                    window.location.hash = '#admin';
                }
            } else if (['#login', '#signup', '#auth'].includes(currentHash) || currentHash === '') {
                window.location.hash = '#category-selection';
            }
        } else {
            state.user = null;
            updateUserInfoUI();
            const protectedHashes = ['#review', '#admin', '#category-selection', '#question', '#my-reviews'];
            if (protectedHashes.includes(window.location.hash.split('?')[0])) {
                window.location.hash = '#login';
            }
        }
    });

    function updateUserInfoUI() {
        userInfoDiv.innerHTML = '';
        verificationNotice.classList.remove('show');
        if (state.user) {
            const userImage = state.user.picture ? `<img src="${state.user.picture}" alt="User profile">` : `<span></span>`;
            const userName = state.user.name ? `<span>Hello, ${state.user.name.split(' ')[0]}</span>` : '';
            userInfoDiv.innerHTML = `
                ${userImage}
                ${userName}
                <a href="#my-reviews" class="text-link">My Reviews</a>
                <button id="sign-out-btn" class="btn">Sign Out</button>`;
            document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth).then(() => { window.location.href = 'index.html'; }));
            
            const isEmailUser = auth.currentUser.providerData.some(p => p.providerId === 'password');
            if (isEmailUser && !state.user.emailVerified) {
                verificationNotice.classList.add('show');
            }
        }
    }
    
    function handleAuthError(error) {
        const currentHash = window.location.hash.split('?')[0];
        const authPages = ['#login', '#signup', '#auth'];
        const message = `Error: ${error.message.replace('Firebase: ', '')}`;
        if (authPages.includes(currentHash)) {
            alert(message);
        } else {
            showMessage(currentHash, message, true);
        }
    }

    // --- AUTH FORM HANDLERS ---
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            await sendEmailVerification(userCredential.user);
            alert("Account created! Please check your email to verify your account.");
        } catch (error) {
            handleAuthError(error);
        }
    });

    document.getElementById('google-login-btn').addEventListener('click', () => 
        signInWithPopup(auth, new GoogleAuthProvider()).catch(handleAuthError)
    );

    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', () => {
            signInWithPopup(auth, new GoogleAuthProvider()).catch(handleAuthError);
        });
    }

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value).catch(handleAuthError);
    });

    // --- ROUTER & NAVIGATION ---
    const pages = document.querySelectorAll('.page');
    const navigateTo = (hash) => {
        const cleanHash = (hash.split('?')[0] || '#login') || '#login';
        
        if (state.user && ['#login', '#signup', '#auth'].includes(cleanHash)) {
            window.location.hash = '#category-selection';
            return;
        }

        const targetPage = document.querySelector(`#page-${cleanHash.substring(1)}`);
        pages.forEach(p => p.classList.remove('active'));
        if (targetPage) {
            targetPage.classList.add('active');
            window.scrollTo(0, 0);
            state.category = new URLSearchParams(hash.split('?')[1]).get('category');
            state.selectedPerfume = new URLSearchParams(hash.split('?')[1]).get('perfume');
            const initializers = { 
                '#question': initQuestionPage, 
                '#review': initReviewPage, 
                '#main': initMainPage, 
                '#admin': initAdminPage,
                '#my-reviews': initMyReviewsPage 
            };
            if (initializers[cleanHash]) {
                initializers[cleanHash]();
            }
        } else {
            window.location.hash = '#login';
        }
    };
    navigateTo(window.location.hash || '#login');
    window.addEventListener('hashchange', () => navigateTo(window.location.hash));
    
    // --- NAVIGATION EVENT LISTENERS ---
    document.getElementById('go-to-login-btn').addEventListener('click', () => { window.location.hash = '#login'; });
    document.getElementById('continue-as-guest-btn').addEventListener('click', () => { window.location.hash = '#category-selection'; });
    document.querySelectorAll('#page-category-selection .card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.hash = `#question?category=${card.dataset.category}`;
        });
    });
    document.getElementById('yes-button').addEventListener('click', () => { if(state.category) window.location.hash = `#review?category=${state.category}`; });
    document.getElementById('no-button').addEventListener('click', () => { if(state.category) window.location.hash = `#main?category=${state.category}`; });
    
    // --- PAGE INITIALIZATION FUNCTIONS ---
    function initQuestionPage(){ 
        if (state.category) {
            document.getElementById('question-header').textContent = `For ${state.category.replace("-", " ")}`;
        }
    }

    function initMainPage(){ 
        if (state.category) {
            document.getElementById('main-header').textContent = `Reviews for ${state.category.replace("-", " ")}`;
            document.getElementById('sort-by').onchange = renderReviews;
            renderReviews();
        }
    }

    function initMyReviewsPage() {
        document.getElementById('my-reviews-header').textContent = 'My Reviews';
        renderMyReviews();
    }

    function initReviewPage() {
        const form = document.getElementById('review-form');
        const submitButton = document.getElementById('submit-review');
        const starRatingContainer = document.getElementById('star-rating');
        const titleInput = document.getElementById('title');
        const photoInputGroup = document.getElementById('photo').parentElement;
        const dateInput = document.getElementById('date-used');
        const requiredInputs = [titleInput, document.getElementById('comments'), dateInput];

        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('max', today);

        form.reset();
        document.getElementById('photo-preview').style.display = 'none';
        submitButton.disabled = true;
        state.rating = 0;
        starRatingContainer.querySelectorAll('.star').forEach(s => s.classList.remove('selected'));

        if (state.selectedPerfume) {
            photoInputGroup.style.display = 'none';
            titleInput.value = state.selectedPerfume;
            titleInput.readOnly = true;
            document.getElementById('review-header').textContent = `Review ${state.selectedPerfume}`;
        } else {
            photoInputGroup.style.display = 'block';
            titleInput.value = '';
            titleInput.readOnly = false;
            document.getElementById('review-header').textContent = `Review Your ${state.category.replace('-', ' ')} Perfume`;
        }

        const checkFormValidity = () => {
            const allInputsFilled = requiredInputs.every(input => input.value.trim() !== '');
            const selectedDate = dateInput.value ? new Date(dateInput.value) : null;
            const currentDate = new Date();
            currentDate.setHours(23, 59, 59, 999);
            const isDateValid = selectedDate && selectedDate <= currentDate;
            const isFormValid = state.rating > 0 && allInputsFilled && isDateValid;
            submitButton.disabled = !isFormValid;
            
            if (isFormValid) {
                const messageDiv = document.getElementById('review-message');
                if (messageDiv) {
                    messageDiv.style.display = 'none';
                    messageDiv.textContent = '';
                    messageDiv.className = '';
                }
            }
        };

        const handleRating = (ratingValue) => {
            state.rating = ratingValue;
            Array.from(starRatingContainer.children).forEach((star, index) =>
                star.classList.toggle('selected', index < ratingValue)
            );
            const ratingText = document.getElementById('rating-number');
            if (ratingText) {
                ratingText.textContent = `${ratingValue}/5`;
            }
            checkFormValidity();
        };

        starRatingContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('star')) {
                handleRating(parseInt(e.target.dataset.value));
            }
        });

        document.getElementById('photo').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('photo-preview').src = event.target.result;
                    document.getElementById('photo-preview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
            checkFormValidity();
        });

        requiredInputs.forEach(input => input.addEventListener('input', checkFormValidity));

        dateInput.addEventListener('change', () => {
            const selectedDate = new Date(dateInput.value);
            const currentDate = new Date();
            currentDate.setHours(23, 59, 59, 999);
            if (dateInput.value && selectedDate > currentDate) {
                dateInput.value = '';
                showMessage('#review', "Date First Used cannot be a future date.", true);
                submitButton.disabled = true;
            }
            checkFormValidity();
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            if (!state.user) {
                showMessage('#review', "You must be logged in to submit.", true);
                return;
            }
            if (auth.currentUser.providerData.some(p => p.providerId === 'password') && !auth.currentUser.emailVerified) {
                showMessage('#review', "Please verify your email before submitting a review.", true);
                return;
            }
            const selectedDate = new Date(dateInput.value);
            const currentDate = new Date();
            currentDate.setHours(23, 59, 59, 999);
            if (selectedDate > currentDate) {
                showMessage('#review', "Date First Used cannot be a future date.", true);
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            try {
                let photoUrl = '';
                const photoFile = document.getElementById('photo').files[0];

                if (photoFile && !state.selectedPerfume) {
                    submitButton.textContent = 'Uploading Photo...';
                    const formData = new FormData();
                    formData.append('file', photoFile);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                    const response = await fetch(CLOUDINARY_URL, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error('Image upload failed.');
                    }
                    const data = await response.json();
                    photoUrl = data.secure_url;
                }

                const reviewData = {
                    photo: photoUrl,
                    rating: state.rating,
                    title: titleInput.value.trim(),
                    comments: document.getElementById('comments').value.trim(),
                    dateUsed: dateInput.value,
                    timestamp: new Date(),
                    userId: state.user.id,
                    userName: state.user.name,
                    status: 'pending'
                };
                await addDoc(collection(db, 'reviews', state.category, 'items'), reviewData);
                showMessage('#review', "Your review has been submitted for approval.", false);
                setTimeout(() => {
                    window.location.hash = '#main?category=' + encodeURIComponent(state.category || '');
                }, 100);
            } catch (error) {
                showMessage('#review', `Error: ${error.message.replace('Firebase: ', '')}`, true);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Review';
            }
        };
    }

    async function renderReviews() {
        if (!state.category) return;
        const grid = document.getElementById('reviews-grid');
        grid.innerHTML = '<p style="text-align: center;">Loading reviews...</p>';

        try {
            const reviewsRef = collection(db, "reviews", state.category, "items");
            const q = query(reviewsRef, where("status", "==", "approved"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const allReviews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (allReviews.length === 0) {
                grid.innerHTML = '<p style="text-align: center;">No approved reviews yet. Be the first to add one!</p>';
                return;
            }

            let productLinks = {};
            try {
                const productLinksRef = collection(db, "product-links");
                const productLinksQuery = query(productLinksRef, where("category", "==", state.category));
                const productLinksSnapshot = await getDocs(productLinksQuery);
                productLinksSnapshot.forEach(doc => {
                    productLinks[doc.id] = doc.data().productUrl;
                });
            } catch (error) {
                console.warn("Failed to fetch product links:", error.message);
                showMessage('#main', "Failed to fetch product links. Reviews loaded without links.", true);
            }

            grid.innerHTML = '';
            const perfumeMap = new Map();

            for (const review of allReviews) {
                const normTitle = review.title?.toLowerCase().trim();
                if (!normTitle) continue;

                if (!perfumeMap.has(normTitle)) {
                    perfumeMap.set(normTitle, { originalTitle: review.title, photo: review.photo, reviews: [] });
                }

                if (!perfumeMap.get(normTitle).photo && review.photo) {
                    perfumeMap.get(normTitle).photo = review.photo;
                }

                perfumeMap.get(normTitle).reviews.push(review);
            }

            perfumeMap.forEach((data, normTitle) => {
                const { originalTitle, photo, reviews } = data;

                const card = document.createElement('div');
                card.className = 'review-card';

                if (photo) {
                    const img = document.createElement('img');
                    img.src = photo;
                    img.alt = originalTitle;
                    card.appendChild(img);
                }

                const avgRating = (
                    reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
                ).toFixed(1);

                const starsHTML = Array.from({ length: 5 }, (_, i) =>
                    `<span class="star ${i < Math.round(avgRating) ? 'selected' : ''}">★</span>`
                ).join('');

                const content = document.createElement('div');
                content.className = 'review-card-content';

                const productUrl = productLinks[normTitle];
                const getOneLink = productUrl
                    ? `<a href="${productUrl}" target="_blank" rel="noopener noreferrer" class="get-one-link">Get One</a>`
                    : '';
                const reviewLink = `<a href="#review?category=${state.category}&perfume=${encodeURIComponent(originalTitle)}" class="text-link">Give Review</a>`;

                content.innerHTML = `
                    <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                        <h3>${originalTitle}</h3>
                        ${getOneLink}
                    </div>
                    <div class="review-card-stars">${starsHTML} <span style="font-weight: normal; font-size: 1rem; color: gold; margin-left: 6px;">${avgRating}/5</span></div>
                    <p style="color: #aaa;">Based on ${reviews.length} review(s)</p>
                    ${reviewLink}
                `;

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'btn btn-toggle-ratings';
                toggleBtn.textContent = `See Reviews`;

                const commentsWrapper = document.createElement('div');
                commentsWrapper.className = 'review-comments';
                commentsWrapper.style.display = 'none';

                reviews.forEach(r => {
                    const comment = document.createElement('div');
                    comment.className = 'review-comment';

                    const date = formatDateOrDaysAgo(r.timestamp);
                    const commentStars = Array.from({ length: 5 }, (_, i) =>
                        `<span class="star ${i < r.rating ? 'selected' : ''}">★</span>`
                    ).join('');

                    comment.innerHTML = `
                        <div class="review-meta">${r.userName || 'User'} • ${date}</div>
                        <div class="review-stars">${commentStars}</div>
                        <p>${r.comments}</p>
                    `;

                    commentsWrapper.appendChild(comment);
                });

                toggleBtn.addEventListener('click', () => {
                    const visible = commentsWrapper.style.display === 'block';
                    commentsWrapper.style.display = visible ? 'none' : 'block';
                    toggleBtn.textContent = visible ? 'See Reviews' : 'Hide Reviews';
                });

                card.appendChild(content);
                card.appendChild(toggleBtn);
                card.appendChild(commentsWrapper);

                document.getElementById('reviews-grid').appendChild(card);
            });
        } catch (error) {
            console.error("Error fetching reviews:", error);
            showMessage('#main', "Failed to load reviews. Please try again later.", true);
        }
    }
    
    async function renderMyReviews() {
        if (!state.user) {
            showMessage('#my-reviews', "You must be logged in to view your reviews.", true);
            window.location.hash = '#login';
            return;
        }
        const grid = document.getElementById('my-reviews-grid');
        grid.innerHTML = '<p style="text-align: center;">Loading your reviews...</p>';

        try {
            const categories = ['him', 'her', 'parents', 'me'];
            const allReviews = [];

            for (const category of categories) {
                const reviewsRef = collection(db, 'reviews', category, 'items');
                const q = query(reviewsRef, where('userId', '==', state.user.id));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach(doc => {
                    allReviews.push({ id: doc.id, category, ...doc.data() });
                });
            }

            if (allReviews.length === 0) {
                grid.innerHTML = '<p style="text-align: center;">You haven\'t submitted any reviews yet.</p>';
                return;
            }

            let productLinks = {};
            try {
                const productLinksRef = collection(db, 'product-links');
                const productLinksSnapshot = await getDocs(productLinksRef);
                productLinksSnapshot.forEach(doc => {
                    productLinks[doc.id] = doc.data().productUrl;
                });
            } catch (error) {
                console.warn('Failed to fetch product links:', error.message);
                showMessage('#my-reviews', 'Failed to fetch product links. Reviews loaded without links.', true);
            }

            grid.innerHTML = '';
            allReviews.forEach(review => {
                const card = document.createElement('div');
                card.className = 'review-card';
                const normTitle = review.title?.toLowerCase().trim();
                const formattedDate = formatDateOrDaysAgo(review.timestamp);
                const starsHTML = Array.from({ length: 5 }, (_, i) =>
                    `<span class="star ${i < review.rating ? 'selected' : ''}">★</span>`
                ).join('');
                const productUrl = productLinks[normTitle];
                const getOneLink = productUrl
                    ? `<a href="${productUrl}" target="_blank" rel="noopener noreferrer" class="get-one-link">Get One</a>`
                    : '';

                card.innerHTML = `
                    ${review.photo ? `<img src="${review.photo}" alt="${review.title || ''}">` : ''}
                    <div class="review-card-content">
                        <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                            <h3>${review.title} <span style="font-size: 1rem; color: #aaa;">(${review.category})</span></h3>
                            ${getOneLink}
                        </div>
                        <div class="review-card-stars">${starsHTML} <span style="font-weight: normal; font-size: 1rem; color: gold; margin-left: 6px;">${review.rating}/5</span></div>
                        <div class="date">Submitted on ${formattedDate}</div>
                        <p>${review.comments}</p>
                        <p style="font-weight: bold; color: ${review.status === 'approved' ? 'var(--accent-gold)' : '#aaa'};">Status: ${review.status.charAt(0).toUpperCase() + review.status.slice(1)}</p>
                    </div>
                `;
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Error fetching your reviews:', error);
            showMessage('#my-reviews', 'Failed to load your reviews. Please try again later.', true);
        }
    }
    
    async function initAdminPage() {
        if (state.user?.id !== ADMIN_UID) {
            showMessage('#admin', "Access denied.", true);
            window.location.hash = "#login";
            return;
        }
        const grid = document.getElementById('admin-reviews-grid');
        grid.innerHTML = '<p style="text-align:center">Loading...</p>';
        const allPendingReviews = [];
        const allApprovedReviews = [];
        const allContactMessages = [];
        const categories = ["him", "her", "parents", "me"];
        let productLinks = {};
        let sponsoredPerfumes = {};
        try {
            try {
                const productLinksRef = collection(db, "product-links");
                const productLinksQuery = query(productLinksRef);
                const productLinksSnapshot = await getDocs(productLinksQuery);
                productLinksSnapshot.forEach(doc => {
                    productLinks[doc.id] = doc.data().productUrl;
                });
            } catch (error) {
                console.warn("Failed to fetch product links:", error.message);
                showMessage('#admin', "Failed to fetch product links.", true);
            }

            try {
                const sponsoredRef = collection(db, "sponsored-perfumes");
                const sponsoredSnapshot = await getDocs(sponsoredRef);
                sponsoredSnapshot.forEach(doc => {
                    sponsoredPerfumes[doc.id] = doc.data().isSponsored;
                });
            } catch (error) {
                console.warn("Failed to fetch sponsored perfumes:", error.message);
                showMessage('#admin', "Failed to fetch sponsored perfumes.", true);
            }

            try {
                const messagesRef = collection(db, 'contact-messages');
                const messagesQuery = query(messagesRef, orderBy("timestamp", "desc"));
                const messagesSnapshot = await getDocs(messagesQuery);
                messagesSnapshot.forEach(doc => allContactMessages.push({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.warn("Failed to fetch contact messages:", error.message);
                showMessage('#admin', "Failed to fetch contact messages.", true);
            }

            for (const category of categories) {
                const reviewsRef = collection(db, 'reviews', category, 'items');
                const pendingQuery = query(reviewsRef, where("status", "==", "pending"), orderBy("timestamp", "desc"));
                const pendingSnapshot = await getDocs(pendingQuery);
                pendingSnapshot.forEach(doc => allPendingReviews.push({ id: doc.id, category: category, ...doc.data() }));
                const approvedQuery = query(reviewsRef, where("status", "==", "approved"), orderBy("timestamp", "desc"));
                const approvedSnapshot = await getDocs(approvedQuery);
                approvedSnapshot.forEach(doc => allApprovedReviews.push({ id: doc.id, category: category, ...doc.data() }));
            }
            grid.innerHTML = '';

            if (allPendingReviews.length === 0) {
                grid.innerHTML += '<p style="text-align:center; font-weight:bold; margin-top: 2rem;">No pending reviews to moderate.</p>';
            } else {
                grid.innerHTML += '<h2 style="text-align:center; color: var(--accent-gold); margin: 2rem 0 1rem 0; display: block; width: 100%;">Pending Reviews</h2>';
                allPendingReviews.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                allPendingReviews.forEach(review => {
                    const card = document.createElement('div');
                    card.className = 'review-card';
                    const formattedDate = formatDateOrDaysAgo(review.timestamp);

                    card.innerHTML = `
                        ${review.photo ? `<img src="${review.photo}" alt="${review.title || ''}">` : ''}
                        <div class="review-card-content">
                            <h3>${review.title} <span style="font-size: 1rem; color: #aaa;">(${review.category})</span></h3>
                            <div class="date">Submitted by ${review.userName || "Guest"} on ${formattedDate}</div>
                            <div class="review-card-stars">${Array.from({length:5},(_,i)=>`<span class="star ${i<review.rating?"selected":""}">★</span>`).join("")}</div>
                            <p>${review.comments}</p>
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-approve" data-id="${review.id}" data-category="${review.category}">Approve</button>
                            <button class="btn btn-reject" data-id="${review.id}" data-category="${review.category}">Reject</button>
                        </div>`;
                    grid.appendChild(card);
                });
            }

            if (allApprovedReviews.length === 0) {
                grid.innerHTML += '<p style="text-align:center; font-weight:bold; margin-top: 2rem;">No approved reviews.</p>';
            } else {
                grid.innerHTML += '<h2 style="text-align:center; color: var(--accent-gold); margin: 2rem 0 1rem 0; display: block; width: 100%;">Approved Reviews</h2>';
                const approvedPerfumeMap = new Map();
                allApprovedReviews.forEach(review => {
                    const normTitle = review.title?.toLowerCase().trim();
                    if (!normTitle) return;
                    if (!approvedPerfumeMap.has(normTitle)) {
                        approvedPerfumeMap.set(normTitle, { originalTitle: review.title, category: review.category, reviews: [], photo: review.photo });
                    }
                    approvedPerfumeMap.get(normTitle).reviews.push(review);
                    if (!approvedPerfumeMap.get(normTitle).photo && review.photo) {
                        approvedPerfumeMap.get(normTitle).photo = review.photo;
                    }
                });

                approvedPerfumeMap.forEach((data, normTitle) => {
                    const { originalTitle, category, photo, reviews } = data;
                    const card = document.createElement('div');
                    card.className = 'review-card';
                    const formattedDate = formatDateOrDaysAgo(reviews[0].timestamp);
                    const avgRating = (
                        reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
                    ).toFixed(1);
                    const starsHTML = Array.from({ length: 5 }, (_, i) =>
                        `<span class="star ${i < Math.round(avgRating) ? 'selected' : ''}">★</span>`
                    ).join('');

                    card.innerHTML = `
                        ${photo ? `<img src="${photo}" alt="${originalTitle || ''}">` : ''}
                        <div class="review-card-content">
                            <h3>${originalTitle} <span style="font-size: 1rem; color: #aaa;">(${category})</span></h3>
                            <div class="date">Last updated on ${formattedDate}</div>
                            <div class="review-card-stars">${starsHTML} <span style="font-weight: normal; font-size: 1rem; color: gold; margin-left: 6px;">${avgRating}/5</span></div>
                            <p>Based on ${reviews.length} review(s)</p>
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-delete" data-id="${reviews[0].id}" data-category="${category}">Delete</button>
                        </div>
                        <div class="product-link-form">
                            <input type="text" class="product-link-input" placeholder="Enter product purchase URL" value="${productLinks[normTitle] || ''}">
                            <button class="btn btn-save-link" data-norm-title="${normTitle}" data-category="${category}" data-original-title="${originalTitle}">Save Link</button>
                        </div>
                        ${productLinks[normTitle] ? `<p class="product-link-display">Current Link: <a href="${productLinks[normTitle]}" target="_blank" class="text-link">${productLinks[normTitle]}</a></p>` : ''}
                    `;
                    grid.appendChild(card);
                });
            }

            const perfumeMap = new Map();
            allApprovedReviews.forEach(review => {
                const normTitle = review.title?.toLowerCase().trim();
                if (!normTitle) return;
                if (!perfumeMap.has(normTitle)) {
                    perfumeMap.set(normTitle, { originalTitle: review.title, category: review.category, photo: review.photo });
                }
                if (!perfumeMap.get(normTitle).photo && review.photo) {
                    perfumeMap.get(normTitle).photo = review.photo;
                }
            });

            grid.innerHTML += '<h2 style="text-align:center; color: var(--accent-gold); margin: 2rem 0 1rem 0; display: block; width: 100%;">Sponsored Perfumes</h2>';
            if (perfumeMap.size === 0) {
                grid.innerHTML += '<p style="text-align:center; font-weight:bold;">No perfumes available.</p>';
            } else {
                perfumeMap.forEach((data, normTitle) => {
                    const { originalTitle, category, photo } = data;
                    const isSponsored = sponsoredPerfumes[normTitle] || false;
                    const card = document.createElement('div');
                    card.className = 'review-card';
                    card.innerHTML = `
                        ${photo ? `<img src="${photo}" alt="${originalTitle || ''}">` : ''}
                        <div class="review-card-content">
                            <h3>${originalTitle} <span style="font-size: 1rem; color: #aaa;">(${category})</span></h3>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    <input type="checkbox" class="sponsored-checkbox" data-norm-title="${normTitle}" data-category="${category}" data-original-title="${originalTitle}" ${isSponsored ? 'checked' : ''}>
                                    Mark as Sponsored
                                </label>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            }

            grid.innerHTML += '<h2 style="text-align:center; color: var(--accent-gold); margin: 2rem 0 1rem 0; display: block; width: 100%;">Contact Messages</h2>';
            if (allContactMessages.length === 0) {
                grid.innerHTML += '<p style="text-align:center; font-weight:bold; margin-top: 2rem;">No contact messages received.</p>';
            } else {
                allContactMessages.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                allContactMessages.forEach(message => {
                    const card = document.createElement('div');
                    card.className = 'review-card';
                    card.style.background = 'var(--background-dark)';
                    card.style.border = '1px solid var(--accent-gold)';
                    card.style.borderRadius = '8px';
                    card.style.padding = '1.5rem';
                    const formattedDate = formatDateOrDaysAgo(message.timestamp);
                    const status = message.status || 'unread';
                    const statusButtonText = status === 'unread' ? 'Mark as Read' : 'Mark as Unread';
                    const statusButtonClass = status === 'unread' ? 'btn-approve' : 'btn-reject';

                    card.innerHTML = `
                        <div class="review-card-content">
                            <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">${message.subject}</h3>
                            <div class="date" style="font-size: 0.9rem; color: #aaa; margin-bottom: 0.5rem;">
                                From: ${message.firstName} ${message.lastName} <<a href="mailto:${message.email}" class="text-link">${message.email}</a>>
                            </div>
                            <div class="date" style="font-size: 0.9rem; color: #aaa; margin-bottom: 1rem;">
                                Received: ${formattedDate}
                            </div>
                            <p style="font-size: 1rem; line-height: 1.5; margin-bottom: 1rem; border-left: 3px solid var(--accent-gold); padding-left: 1rem;">
                                ${message.message}
                            </p>
                            <p style="font-weight: bold; color: ${status === 'unread' ? 'var(--accent-gold)' : '#aaa'}; font-size: 0.9rem;">
                                Status: ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </p>
                        </div>
                        <div class="admin-actions" style="margin-top: 1rem; text-align: right;">
                            <button class="btn ${statusButtonClass}" data-id="${message.id}" data-status="${status}">${statusButtonText}</button>
                            <button class="btn btn-reject" data-id="${message.id}" data-action="delete">Delete</button>
                        </div>`;
                    grid.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showMessage('#admin', "Failed to load data. Please try again later.", true);
        }

        grid.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.matches('.btn-approve, .btn-reject, .btn-delete')) {
                target.disabled = true;
                const reviewId = target.dataset.id;
                const category = target.dataset.category;
                const action = target.dataset.action;
                if (!reviewId || !category) {
                    if (target.dataset.id) {
                        const messageId = target.dataset.id;
                        const messageDocRef = doc(db, 'contact-messages', messageId);
                        try {
                            if (action === 'delete') {
                                await deleteDoc(messageDocRef);
                                target.closest('.review-card').remove();
                                showMessage('#admin', "Message deleted successfully.", false);
                            } else {
                                const currentStatus = target.dataset.status;
                                const newStatus = currentStatus === 'unread' ? 'read' : 'unread';
                                await updateDoc(messageDocRef, { status: newStatus });
                                target.closest('.review-card').style.opacity = '0.5';
                                target.closest('.admin-actions').innerHTML = `<p style="text-align: right; font-weight: bold; color: ${newStatus === 'read' ? 'var(--accent-gold)' : '#aaa'}">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</p>`;
                                showMessage('#admin', `Message marked as ${newStatus}.`, false);
                            }
                        } catch (error) {
                            console.error("Error updating message:", error);
                            showMessage('#admin', "Failed to update message. Try again.", true);
                            target.disabled = false;
                        }
                        return;
                    }
                    return;
                }
                const reviewDocRef = doc(db, 'reviews', category, 'items', reviewId);
                try {
                    if (target.classList.contains('btn-delete')) {
                        await updateDoc(reviewDocRef, { status: 'deleted' });
                        target.closest('.review-card').style.opacity = '0.5';
                        target.closest('.admin-actions').innerHTML = `<p style="text-align: right; font-weight: bold; color: #aaa;">Deleted</p>`;
                        showMessage('#admin', "Review deleted successfully.", false);
                    } else {
                        const newStatus = target.classList.contains('btn-approve') ? 'approved' : 'rejected';
                        await updateDoc(reviewDocRef, { status: newStatus });
                        target.closest('.review-card').style.opacity = '0.5';
                        target.closest('.admin-actions').innerHTML = `<p style="text-align: right; font-weight: bold; color: ${newStatus === 'approved' ? 'var(--accent-gold)' : '#aaa'}">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</p>`;
                        showMessage('#admin', `Review ${newStatus} successfully.`, false);
                    }
                } catch (error) {
                    console.error("Error updating review status:", error);
                    showMessage('#admin', "Failed to update review status. Try again.", true);
                    target.disabled = false;
                }
            } else if (target.matches('.btn-save-link')) {
                target.disabled = true;
                const normTitle = target.dataset.normTitle;
                const category = target.dataset.category;
                const originalTitle = target.dataset.originalTitle;
                const input = target.previousElementSibling;
                const productUrl = input.value.trim();
                try {
                    if (productUrl) {
                        let validUrl = productUrl;
                        if (!validUrl.match(/^https?:\/\//i)) {
                            validUrl = `https://${validUrl}`;
                        }
                        new URL(validUrl);
                        console.log(`Saving product link for ${normTitle} by user ${state.user.id}: ${validUrl}`);
                        await setDoc(doc(db, 'product-links', normTitle), {
                            productUrl: validUrl,
                            category,
                            originalTitle
                        });
                        const linkDisplay = target.closest('.review-card').querySelector('.product-link-display') || document.createElement('p');
                        linkDisplay.className = 'product-link-display';
                        linkDisplay.innerHTML = `Current Link: <a href="${validUrl}" target="_blank" class="text-link">${validUrl}</a>`;
                        target.parentElement.insertAdjacentElement('afterend', linkDisplay);
                        showMessage('#admin', "Product link saved successfully.", false);
                    } else {
                        console.log(`Clearing product link for ${normTitle} by user ${state.user.id}`);
                        await setDoc(doc(db, 'product-links', normTitle), {
                            productUrl: '',
                            category,
                            originalTitle
                        });
                        const linkDisplay = target.closest('.review-card').querySelector('.product-link-display');
                        if (linkDisplay) linkDisplay.remove();
                        showMessage('#admin', "Product link cleared.", false);
                    }
                } catch (error) {
                    console.error(`Error saving product link for ${normTitle}:`, error.code, error.message, { userId: state.user.id });
                    if (error.message.includes('Invalid URL')) {
                        showMessage('#admin', "Please enter a valid URL (e.g., https://example.com).", true);
                    } else {
                        showMessage('#admin', `Failed to save product link: ${error.message}`, true);
                    }
                    target.disabled = false;
                }
            } else if (target.matches('.sponsored-checkbox')) {
                const normTitle = target.dataset.normTitle;
                const category = target.dataset.category;
                const originalTitle = target.dataset.originalTitle;
                const isSponsored = target.checked;
                try {
                    console.log(`Updating sponsored status for ${normTitle}: ${isSponsored}`);
                    await setDoc(doc(db, 'sponsored-perfumes', normTitle), {
                        isSponsored,
                        category,
                        originalTitle
                    });
                    showMessage('#admin', `Sponsored status for "${originalTitle}" updated successfully.`, false);
                } catch (error) {
                    console.error(`Error updating sponsored status for ${normTitle}:`, error);
                    showMessage('#admin', "Failed to update sponsored status. Try again.", true);
                    target.checked = !isSponsored;
                }
            }
        });
    }

    function showThankYouModal(title, message) {
        showMessage('#review', message, false);
    }

    const forgotPasswordBtn = document.getElementById("forgot-password-btn");
    const overlay = document.getElementById("forgot-password-overlay");
    const closeForgot = document.getElementById("close-forgot-modal");
    const forgotForm = document.getElementById("forgot-password-form");
    const emailInput = document.getElementById("forgot-modal-email");
    const messageBox = document.getElementById("forgot-modal-message");
    const sendResetBtn = document.getElementById("forgot-modal-submit");

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", (e) => {
            e.preventDefault();
            overlay.style.display = "flex";
            emailInput.value = "";
            messageBox.textContent = "We'll send a password reset link to your email.";
            messageBox.style.color = "#333";
        });

        closeForgot.addEventListener('click', () => {
            overlay.style.display = "none";
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay.style.display === "flex") {
                overlay.style.display = "none";
            }
        });

        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim();

            if (!email) {
                messageBox.style.color = "red";
                messageBox.textContent = "Please enter your email address.";
                return;
            }

            sendResetBtn.disabled = true;
            messageBox.style.color = "";
            messageBox.textContent = "Sending reset email...";

            try {
                await sendPasswordResetEmail(auth, email);
                messageBox.style.color = "green";
                messageBox.textContent = "Reset link sent to your email.";
            } catch (error) {
                messageBox.style.color = "red";
                messageBox.textContent = error.message.replace("Firebase:", "").trim();
            } finally {
                sendResetBtn.disabled = false;
            }
        });
    }

    const resendVerificationLink = document.getElementById('resend-verification');
    if (resendVerificationLink) {
        resendVerificationLink.addEventListener('click', async (e) => {
            e.preventDefault();
            if (auth.currentUser) {
                try {
                    await sendEmailVerification(auth.currentUser);
                    alert("Verification email resent. Please check your inbox.");
                } catch (error) {
                    handleAuthError(error);
                }
            }
        });
    }
});

function formatDateOrDaysAgo(timestamp) {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
        return "Today";
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-GB');
    }
}