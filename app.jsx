import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseclient.js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './styles.css';

function App() {
  const [role, setRole] = useState(null); 
  const [userEmail, setUserEmail] = useState(''); 
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]); 
  const [selectedRoles, setSelectedRoles] = useState({}); 
  
  const [activeTab, setActiveTab] = useState('food');
  const [adminTab, setAdminTab] = useState('dashboard');
  
  const [orderSearch, setOrderSearch] = useState(''); 
  const [productSearch, setProductSearch] = useState(''); 
  
  const [adminCategoryTab, setAdminCategoryTab] = useState('food');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', price: '', unit: 'kpl', stock: '', category: 'food', barcode: '', expiration_date: ''
  });

  const [isScanning, setIsScanning] = useState(false);
  const [discountFormId, setDiscountFormId] = useState(null);
  const [discountValue, setDiscountValue] = useState('');
  const [announceDiscount, setAnnounceDiscount] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); 
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [wishlist, setWishlist] = useState({});
  const [customWish, setCustomWish] = useState(''); 
  const [announcement, setAnnouncement] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState(''); 

  useEffect(() => {
    const getUserRole = async (user) => {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setRole(data ? data.role : 'odottaa'); 
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        getUserRole(session.user);
        setUserEmail(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        getUserRole(session.user);
        setUserEmail(session.user.email);
      } else {
        setRole(null);
        setUserEmail('');
      }
    });

    fetchProducts();
    fetchOrders();
    fetchAnnouncement();
    fetchUsers();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 150} }, false);
      scanner.render((decodedText) => {
        scanner.clear();
        setIsScanning(false);
        handleBarcodeScanned(decodedText);
      }, () => {});
    }
    return () => { if (scanner) scanner.clear().catch(e => console.error(e)); };
  }, [isScanning]);

  const handleBarcodeScanned = async (scannedCode) => {
    const existingProduct = products.find(p => p.barcode === scannedCode);
    if (existingProduct) {
      const amountToAdd = window.prompt(`Tuote löytyi: ${existingProduct.name}\nSaldossa nyt: ${existingProduct.stock}\nKuinka monta lisätään?`, "1");
      if (amountToAdd && !isNaN(amountToAdd)) {
        const newStock = existingProduct.stock + parseInt(amountToAdd, 10);
        const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', existingProduct.id);
        if (!error) {
          alert(`Saldo päivitetty!`);
          fetchProducts();
        }
      }
    } else {
      alert(`Uusi viivakoodi havaittu.\nLisää tuotteen tiedot lomakkeeseen.`);
      setAdminTab('products');
      setNewProduct(prev => ({ ...prev, barcode: scannedCode }));
      setShowAddForm(true);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('role');
    if (!error && data) setUsers(data);
  };

  const updateUserRole = async (id, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    if (!error) fetchUsers(); 
  };

  const fetchAnnouncement = async () => {
    const { data } = await supabase.from('announcements').select('message').eq('id', 1).single();
    if (data) {
      setAnnouncement(data.message);
      setNewAnnouncement(data.message);
    }
  };

  const handleUpdateAnnouncement = async () => {
    const { error } = await supabase.from('announcements').update({ message: newAnnouncement }).eq('id', 1);
    if (!error) {
      setAnnouncement(newAnnouncement);
      alert('Tiedote päivitetty!');
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error) setProducts(data);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, customer_name, status, created_at, custom_wish, upvotes,
        order_items ( amount, price_at_time, products ( name ) )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedOrders = data.map(o => ({
        id: o.id.substring(0, 5),
        real_id: o.id,
        customer: o.customer_name,
        status: o.status,
        custom_wish: o.custom_wish,
        upvotes: o.upvotes || [], 
        date: new Date(o.created_at).toLocaleDateString('fi-FI'),
        items: o.order_items.map(item => ({
          name: item.products ? item.products.name : 'Poistettu tuote',
          amount: item.amount
        }))
      }));
      setOrders(formattedOrders);
    }
  };

  const handleUpvote = async (realId, currentUpvotes) => {
    if (currentUpvotes.includes(userEmail)) return; 
    const newUpvotes = [...currentUpvotes, userEmail];
    const { error } = await supabase.from('orders').update({ upvotes: newUpvotes }).eq('id', realId);
    if (!error) fetchOrders(); 
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      alert("Kirjoita sähköpostiosoitteesi ensin yllä olevaan kenttään.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) {
      alert("Virhe linkin lähetyksessä: " + error.message);
    } else {
      alert("Linkki lähetetty!");
      setIsForgotPassword(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert("Virhe: " + error.message);
      } else {
        alert("Tili luotu! Odotetaan hyväksyntää.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert("Kirjautuminen epäonnistui: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUserEmail('');
    setAdminTab('dashboard');
    setWishlist({});
    setCustomWish('');
    setEmail('');
    setPassword('');
  };

  const updateWishlist = (productId, delta) => {
    setWishlist(prev => {
      const currentAmount = prev[productId] || 0;
      const newAmount = currentAmount + delta;
      if (newAmount <= 0) {
        const newWishlist = { ...prev };
        delete newWishlist[productId];
        return newWishlist;
      }
      return { ...prev, [productId]: newAmount };
    });
  };

  const submitWishlist = async () => {
    if (Object.keys(wishlist).length === 0 && customWish.trim() === '') return;
    
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ customer_name: userEmail, status: 'pending', custom_wish: customWish }])
      .select()
      .single();

    if (orderError) {
      alert("Virhe tilauksen lähetyksessä!");
      return;
    }

    if (Object.keys(wishlist).length > 0) {
      const orderItemsData = Object.entries(wishlist).map(([id, amount]) => {
        const product = products.find(p => p.id === id);
        return {
          order_id: orderData.id,
          product_id: id,
          amount: amount,
          price_at_time: product.price
        };
      });
      await supabase.from('order_items').insert(orderItemsData);
    }
    
    alert("Toiveet lähetetty onnistuneesti!");
    setWishlist({});
    setCustomWish('');
    fetchOrders(); 
  };

  const updateOrderStatus = async (realId, newStatus) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', realId);
    if (!error) {
      setOrders(orders.map(o => o.real_id === realId ? { ...o, status: newStatus } : o));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const productToInsert = {
      name: newProduct.name,
      description: newProduct.description,
      price: parseFloat(newProduct.price),
      unit: newProduct.unit,
      stock: parseInt(newProduct.stock),
      category: newProduct.category,
      barcode: newProduct.barcode,
      expiration_date: newProduct.expiration_date || null
    };
    const { error } = await supabase.from('products').insert([productToInsert]);
    if (!error) { 
      alert("Tuote lisätty!"); 
      setNewProduct({ name: '', description: '', price: '', unit: 'kpl', stock: '', category: 'food', barcode: '', expiration_date: '' }); 
      setShowAddForm(false);
      fetchProducts(); 
    } else {
      alert("Virhe tuotteen lisäyksessä: " + error.message);
    }
  };

  const handleUpdateStockManual = async (product) => {
    const newStock = window.prompt(`Muokkaa tuotteen ${product.name} saldoa:\nNykyinen saldo: ${product.stock}`, product.stock);
    if (newStock !== null && !isNaN(newStock)) {
      const { error } = await supabase.from('products').update({ stock: parseInt(newStock) }).eq('id', product.id);
      if (!error) {
        fetchProducts();
      } else {
        alert("Virhe saldon päivityksessä.");
      }
    }
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`VAROITUS: Haluatko varmasti poistaa tuotteen "${product.name}" kokonaan järjestelmästä?`)) {
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (!error) {
        fetchProducts();
      } else {
        alert("Virhe poistossa.");
      }
    }
  };

  const handleSetDiscount = async (product) => {
    const { error } = await supabase.from('products').update({ discount_price: parseFloat(discountValue) }).eq('id', product.id);
    if (!error) {
      if (announceDiscount) {
        const promoMsg = `📢 HUOM! ${product.name} nyt alennuksessa ${parseFloat(discountValue).toFixed(2)} € (menee pian vanhaksi)! Hae omasi nopeasti.`;
        await supabase.from('announcements').update({ message: promoMsg }).eq('id', 1);
        setAnnouncement(promoMsg);
        setNewAnnouncement(promoMsg);
      }
      alert("Alennus asetettu!");
      setDiscountFormId(null);
      setDiscountValue('');
      fetchProducts();
    }
  };

  const handleMarkAsWaste = async (product) => {
    if(window.confirm(`Haluatko varmasti merkitä tuotteen ${product.name} hävikiksi? Saldo nollataan.`)) {
      const { error } = await supabase.from('products').update({ stock: 0, discount_price: null }).eq('id', product.id);
      if (!error) fetchProducts();
    }
  };

  const removeDiscount = async (product) => {
    const { error } = await supabase.from('products').update({ discount_price: null }).eq('id', product.id);
    if (!error) fetchProducts();
  };

  const Header = () => (
    <header>
      <div className="logo"><span className="logo-icon">S</span> Saaristokauppa</div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          Kirjautuneena: <span style={{ color: '#fff', fontWeight: 'bold' }}>{role.toUpperCase()}</span>
        </span>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>
          Kirjaudu ulos
        </button>
      </div>
    </header>
  );

  const renderOrderCard = (order, actions) => (
    <div key={order.id} className="product-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>#{order.id} — {order.customer}</h3>
        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{order.date}</span>
      </div>
      
      {order.upvotes && order.upvotes.length > 0 && (
        <div style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>🔥</span> +{order.upvotes.length} muuta asiakasta haluaa tätä
        </div>
      )}
      
      {order.custom_wish && (
        <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid #38bdf8' }}>
          <span style={{ color: '#e2e8f0', fontStyle: 'italic', fontSize: '0.95rem' }}>"{order.custom_wish}"</span>
        </div>
      )}
      
      <ul style={{ color: '#cbd5e1', paddingLeft: '20px', marginBottom: '15px', fontSize: '0.95rem' }}>
        {order.items.map((item, i) => (
          <li key={i}><strong>{item.amount} kpl</strong> - {item.name}</li>
        ))}
      </ul>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        {actions}
      </div>
    </div>
  );

  if (!role) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <h2><span className="logo-icon">⚓</span> Saaristokauppa</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ color: '#f8fafc', margin: '0 0 10px 0', textAlign: 'center' }}>
              {isSignUp ? 'Luo asiakastili' : 'Kirjaudu sisään'}
            </h3>
            <input 
              type="email" 
              placeholder="Sähköposti" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }} 
            />
            <input 
              type="password" 
              placeholder="Salasana" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }} 
            />
            <button type="submit" className="btn-login" style={{ marginTop: '10px', backgroundColor: '#10b981' }}>
              {isSignUp ? 'Luo tili' : 'Kirjaudu sisään'}
            </button>
          </form>
          <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '25px 0' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{isSignUp ? 'Onko sinulla jo tili? ' : 'Eikö sinulla ole tiliä? '}</span>
            <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}>
              {isSignUp ? 'Kirjaudu tästä' : 'Luo tili'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'odottaa') {
    return (
      <div className="app-container">
        <Header />
        <div className="main-content" style={{ textAlign: 'center', marginTop: '50px' }}>
          <span style={{ fontSize: '4rem' }}>⏳</span>
          <h1 style={{ color: '#f8fafc', margin: '20px 0' }}>Tili odottaa hyväksyntää</h1>
          <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto' }}>
            Kauppias tarkistaa ja hyväksyy uudet asiakastilit manuaalisesti.
          </p>
        </div>
      </div>
    );
  }

  if (role === 'asiakas') {
    const filteredProducts = products.filter(p => 
      p.category === activeTab && 
      (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase())))
    );
    
    const totalWishesCount = Object.values(wishlist).reduce((sum, current) => sum + current, 0);
    const myOrders = orders.filter(o => o.customer === userEmail); 
    const communityOrders = orders.filter(o => o.customer !== userEmail && (o.status === 'pending' || o.status === 'approved' || o.status === 'ordered'));

    return (
      <div className="app-container">
        <Header />
        <div className="main-content">
          
          {announcement && announcement.trim() !== '' && (
            <div style={{ backgroundColor: '#f59e0b', color: '#0f172a', padding: '15px 20px', borderRadius: '8px', marginBottom: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '1.5rem' }}>📢</span>
              <span>{announcement}</span>
            </div>
          )}

          <h1>Valikoima ja Varasto</h1>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Etsi tuotteita nimellä tai kuvauksella..." 
              value={productSearch} 
              onChange={(e) => setProductSearch(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '1rem' }} 
            />
          </div>

          <div className="tabs">
            <button className={activeTab === 'food' ? 'active' : ''} onClick={() => setActiveTab('food')}>🍎 Elintarvikkeet</button>
            <button className={activeTab === 'hardware' ? 'active' : ''} onClick={() => setActiveTab('hardware')}>🔨 Rautakauppa</button>
          </div>
          
          <div className="product-grid">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-card" style={{ opacity: product.stock === 0 ? 0.7 : 1, border: product.discount_price ? '2px solid #ef4444' : 'none' }}>
                {product.discount_price && (
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', padding: '5px 10px', borderRadius: '20px', fontWeight: 'bold' }}>ALE</div>
                )}
                
                <h3>{product.name}</h3>
                <div className="product-desc">{product.description}</div>
                
                <div className="product-price">
                  {product.discount_price ? (
                    <>
                      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.4rem' }}>{Number(product.discount_price).toFixed(2)} €</span>
                      <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginLeft: '10px', fontSize: '0.9rem' }}>{Number(product.price).toFixed(2)} €</span> / {product.unit}
                    </>
                  ) : (
                    `${Number(product.price).toFixed(2)} € / ${product.unit}`
                  )}
                </div>

                <div className="product-meta">
                  <span className="stock-info" style={{ color: product.stock === 0 ? '#ef4444' : '#94a3b8', fontWeight: product.stock === 0 ? 'bold' : 'normal' }}>
                    {product.stock === 0 ? 'LOUPPUUNMYYTY' : `Varastossa: ${product.stock}`}
                  </span>
                </div>
                
                <div style={{ marginTop: '15px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Toivo kauppiaalta lisää:</span>
                  <div className="controls">
                    <button className="btn-icon" onClick={() => updateWishlist(product.id, -1)}>-</button>
                    <span style={{ minWidth: '20px', textAlign: 'center' }}>{wishlist[product.id] || 0}</span>
                    <button className="btn-icon btn-add" onClick={() => updateWishlist(product.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && <p style={{ color: '#94a3b8', gridColumn: '1 / -1' }}>Ei tuotteita tällä hakusanalla.</p>}
          </div>

          <div style={{ marginTop: '40px', backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#f8fafc' }}>Eikö etsimääsi löytynyt?</h3>
            <textarea 
              value={customWish} 
              onChange={(e) => setCustomWish(e.target.value)} 
              placeholder="Kirjoita vapaa toive, esim. 98-bensaa..." 
              style={{ width: '100%', padding: '15px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }} 
            />
          </div>

          {(Object.keys(wishlist).length > 0 || customWish.trim() !== '') && (
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#0f172a', border: '1px solid #38bdf8', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#f8fafc' }}>Lähetettävät toiveet</h3>
                <p style={{ margin: 0, color: '#94a3b8' }}>{Object.keys(wishlist).length > 0 ? `Valittuna ${totalWishesCount} kpl tuotteita.` : 'Vain erikoistoive.'}</p>
              </div>
              <button onClick={submitWishlist} style={{ padding: '12px 24px', backgroundColor: '#38bdf8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Lähetä toiveet
              </button>
            </div>
          )}

          {communityOrders.length > 0 && (
            <div style={{ marginTop: '50px' }}>
              <h2 style={{ color: '#f59e0b', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>Naapureiden aktiiviset toiveet</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Puuttuuko sinultakin näitä? Paina nappia, niin kauppias huomaa suuremman kysynnän!</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {communityOrders.map(order => (
                  renderOrderCard(order, (
                    <button 
                      disabled={order.upvotes.includes(userEmail)}
                      onClick={() => handleUpvote(order.real_id, order.upvotes)} 
                      style={{ 
                        padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: order.upvotes.includes(userEmail) ? 'default' : 'pointer',
                        border: order.upvotes.includes(userEmail) ? '1px solid #10b981' : '1px solid #f59e0b',
                        background: order.upvotes.includes(userEmail) ? '#10b98120' : 'transparent',
                        color: order.upvotes.includes(userEmail) ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {order.upvotes.includes(userEmail) ? '✅ Olet äänestänyt tätä' : '🔥 +1 Haluan myös tätä'}
                    </button>
                  ))
                ))}
              </div>
            </div>
          )}

          {myOrders.length > 0 && (
            <div style={{ marginTop: '50px' }}>
              <h2 style={{ color: '#f8fafc', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>Omat toiveet ja tilaukset</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                {myOrders.map(order => renderOrderCard(order, (
                  <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.95rem' }}>
                    {order.status === 'pending' && <span style={{ color: '#f59e0b' }}>⏳ Kauppias harkitsee tilausta.</span>}
                    {order.status === 'approved' && <span style={{ color: '#38bdf8' }}>📝 Hyväksytty, odottaa tukkutilausta.</span>}
                    {order.status === 'ordered' && <span style={{ color: '#38bdf8' }}>🚚 Tilattu! Ilmoitamme kun saapuu.</span>}
                    {order.status === 'arrived' && <span style={{ color: '#10b981' }}>✅ Noudettavissa!</span>}
                    {order.status === 'rejected' && <span style={{ color: '#ef4444' }}>❌ Hylätty.</span>}
                  </span>
                )))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  if (role === 'kauppias' || role === 'admin') {
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringSoon = products.filter(p => {
      if (!p.expiration_date || p.stock === 0) return false;
      const expDate = new Date(p.expiration_date);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 3;
    });

    const expired = products.filter(p => {
      if (!p.expiration_date || p.stock === 0) return false;
      const expDate = new Date(p.expiration_date);
      return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)) <= 0;
    });

    const pendingUsers = users.filter(u => u.role === 'odottaa');
    
    const searchedOrders = orders.filter(o => {
      if (!orderSearch) return true;
      const s = orderSearch.toLowerCase();
      return (
        o.customer.toLowerCase().includes(s) || 
        (o.custom_wish && o.custom_wish.toLowerCase().includes(s)) ||
        o.items.some(item => item.name.toLowerCase().includes(s))
      );
    });

    const pendingOrders = searchedOrders.filter(o => o.status === 'pending');
    const approvedOrders = searchedOrders.filter(o => o.status === 'approved');
    const orderedOrders = searchedOrders.filter(o => o.status === 'ordered');
    const archivedOrders = searchedOrders.filter(o => o.status === 'arrived' || o.status === 'rejected');

    const groupedArchive = archivedOrders.reduce((acc, order) => {
      const [day, month, year] = order.date.split('.');
      const dateObj = new Date(year, month - 1);
      const monthName = dateObj.toLocaleString('fi-FI', { month: 'long', year: 'numeric' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      if (!acc[capitalizedMonth]) acc[capitalizedMonth] = [];
      acc[capitalizedMonth].push(order);
      return acc;
    }, {});

    const adminFilteredProducts = products.filter(p => 
      p.category === adminCategoryTab &&
      (!productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase())))
    );

    return (
      <div className="app-container">
        <Header />
        <div className="main-content">
          <h1>Hallintapaneeli</h1>
          <div className="tabs">
            <button className={adminTab === 'dashboard' ? 'active' : ''} onClick={() => setAdminTab('dashboard')}>📊 Kojelauta</button>
            <button className={adminTab === 'products' ? 'active' : ''} onClick={() => setAdminTab('products')}>📦 Varasto</button>
            <button className={adminTab === 'orders' ? 'active' : ''} onClick={() => setAdminTab('orders')}>
              💭 Tuotetoiveet {pendingOrders.length > 0 && <span style={{ color: '#38bdf8', marginLeft: '5px' }}>({pendingOrders.length})</span>}
            </button>
            <button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>
              👥 Käyttäjät {pendingUsers.length > 0 && <span style={{ color: '#f59e0b', marginLeft: '5px' }}>({pendingUsers.length})</span>}
            </button>
          </div>
          
          {adminTab === 'dashboard' && (
            <div>
              <div className="product-grid" style={{ marginBottom: '30px' }}>
                <div className="product-card" style={{ borderLeft: '4px solid #38bdf8' }}>
                  <h3 style={{ color: '#94a3b8' }}>Uusia toiveita</h3>
                  <p style={{ fontSize: '2.5rem', margin: '10px 0', color: '#f8fafc' }}>{pendingOrders.length}</p>
                </div>
                <div className="product-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ color: '#94a3b8' }}>Odottavia asiakkaita</h3>
                  <p style={{ fontSize: '2.5rem', margin: '10px 0', color: '#f8fafc' }}>{pendingUsers.length}</p>
                </div>
                <div className="product-card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <h3 style={{ color: '#94a3b8' }}>Vanhenee pian</h3>
                  <p style={{ fontSize: '2.5rem', margin: '10px 0', color: '#f8fafc' }}>{expiringSoon.length + expired.length}</p>
                </div>
              </div>

              {(expiringSoon.length > 0 || expired.length > 0) && (
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ef4444' }}>
                  <h2 style={{ color: '#ef4444', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>⚠️</span> Hävikinhallinta ja hälytykset
                  </h2>
                  
                  {expired.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#f8fafc', fontSize: '1rem', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>🚨 Jo vanhentuneet</h3>
                      {expired.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px', borderRadius: '6px', marginTop: '10px' }}>
                          <div>
                            <strong style={{ color: '#fff' }}>{p.name}</strong> 
                            <span style={{ color: '#94a3b8', marginLeft: '10px' }}>({p.stock} kpl) - Pvm: {new Date(p.expiration_date).toLocaleDateString('fi-FI')}</span>
                          </div>
                          <button onClick={() => handleMarkAsWaste(p)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Poista varastosta (Hävikki)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {expiringSoon.length > 0 && (
                    <div>
                      <h3 style={{ color: '#f59e0b', fontSize: '1rem', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>⏳ Vanhenee 3 päivän sisällä</h3>
                      {expiringSoon.map(p => (
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#0f172a', padding: '10px', borderRadius: '6px', marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <strong style={{ color: '#fff' }}>{p.name}</strong> 
                              <span style={{ color: '#94a3b8', marginLeft: '10px' }}>({p.stock} kpl) - Pvm: {new Date(p.expiration_date).toLocaleDateString('fi-FI')}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              {p.discount_price && (
                                <button onClick={() => removeDiscount(p)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Poista Ale</button>
                              )}
                              <button onClick={() => setDiscountFormId(discountFormId === p.id ? null : p.id)} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {p.discount_price ? 'Muokkaa alea' : 'Aseta alennus'}
                              </button>
                            </div>
                          </div>
                          
                          {discountFormId === p.id && (
                            <div style={{ background: '#1e293b', padding: '15px', borderRadius: '6px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                placeholder={`Uusi hinta (Nyt ${p.price}€)`} 
                                value={discountValue} 
                                onChange={e => setDiscountValue(e.target.value)} 
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff', width: '150px' }} 
                              />
                              <label style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={announceDiscount} onChange={(e) => setAnnounceDiscount(e.target.checked)} /> 
                                Tee mainos
                              </label>
                              <button onClick={() => handleSetDiscount(p)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Tallenna
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#f8fafc' }}>📢 Kaupan kuulumiset</h3>
                <textarea 
                  value={newAnnouncement} 
                  onChange={(e) => setNewAnnouncement(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} 
                />
                <button onClick={handleUpdateAnnouncement} style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
                  Päivitä tiedote
                </button>
              </div>
            </div>
          )}

          {adminTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ color: '#f8fafc', margin: 0 }}>Varastotilanne</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => setIsScanning(!isScanning)} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isScanning ? 'Sulje Kamera' : '📷 Skannaa viivakoodi'}
                  </button>
                  <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {showAddForm ? 'Peruuta' : '+ Lisää käsin'}
                  </button>
                </div>
              </div>

              {isScanning && (
                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '2px dashed #f59e0b' }}>
                  <h3 style={{ margin: '0 0 15px', color: '#f8fafc', textAlign: 'center' }}>Kohdista viivakoodi kameraan</h3>
                  <div id="reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto', backgroundColor: '#0f172a' }}></div>
                </div>
              )}

              {showAddForm && (
                <form onSubmit={handleAddProduct} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Uuden tuotteen tiedot</h3>
                  
                  {/* Mobiiliystävällinen Flexbox-rakenne */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    <input type="text" placeholder="Viivakoodi (EAN)" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} style={{ flex: '1 1 150px', padding: '10px', borderRadius: '4px', border: '1px solid #38bdf8', background: '#0f172a', color: '#fff' }} />
                    <input type="text" placeholder="Tuotteen nimi" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} style={{ flex: '1 1 150px', padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} />
                  </div>
                  
                  <input type="text" placeholder="Lyhyt kuvaus" required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} />
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    <input type="number" step="0.01" placeholder="Hinta (€)" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ flex: '1 1 100px', padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} />
                    <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} style={{ flex: '1 1 80px', padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}>
                      <option value="kpl">kpl</option><option value="pkt">pkt</option><option value="kg">kg</option><option value="l">litra</option>
                    </select>
                    <input type="number" placeholder="Varastosaldo (kpl)" required value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} style={{ flex: '1 1 120px', padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ flex: '1 1 150px', padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}>
                      <option value="food">Elintarvike</option><option value="hardware">Rautakauppa</option>
                    </select>
                    <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Viimeinen käyttöpäivä (vapaaehtoinen)</label>
                      <input type="date" value={newProduct.expiration_date} onChange={e => setNewProduct({...newProduct, expiration_date: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff', colorScheme: 'dark' }} />
                    </div>
                  </div>
                  
                  <button type="submit" style={{ padding: '12px', backgroundColor: '#38bdf8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>Tallenna tuote</button>
                </form>
              )}

              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Etsi varastosta nimellä tai kuvauksella..." 
                  value={productSearch} 
                  onChange={(e) => setProductSearch(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '1rem' }} 
                />
              </div>

              <div className="tabs" style={{ marginTop: '10px' }}>
                <button className={adminCategoryTab === 'food' ? 'active' : ''} onClick={() => setAdminCategoryTab('food')}>🍎 Elintarvikkeet</button>
                <button className={adminCategoryTab === 'hardware' ? 'active' : ''} onClick={() => setAdminCategoryTab('hardware')}>🔨 Rautakauppa</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {adminFilteredProducts.map(product => (
                  <div key={product.id} className="product-card" style={{ border: product.discount_price ? '1px solid #ef4444' : 'none' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ color: '#f8fafc', margin: '0 0 5px 0' }}>
                          {product.name} 
                          {product.discount_price && <span style={{ color: '#ef4444', fontSize: '0.9rem', marginLeft: '10px' }}>ALE</span>}
                        </h3>
                        <div className="product-price" style={{ marginBottom: 0, fontSize: '0.95rem' }}>
                          {product.discount_price ? <span style={{ color: '#ef4444' }}>{Number(product.discount_price).toFixed(2)} € (norm. {Number(product.price).toFixed(2)} €)</span> : `${Number(product.price).toFixed(2)} €`}
                        </div>
                        {product.barcode && <span style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginTop: '5px' }}>Viivakoodi: {product.barcode}</span>}
                        {product.expiration_date && <span style={{ color: '#f59e0b', fontSize: '0.85rem', display: 'block', marginTop: '2px' }}>Pvm: {new Date(product.expiration_date).toLocaleDateString('fi-FI')}</span>}
                      </div>
                      <span className="stock-info" style={{ color: product.stock === 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                        {product.stock === 0 ? '❌ LOPPU' : `📦 ${product.stock} kpl`}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                      <button onClick={() => handleUpdateStockManual(product)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        ✎ Muokkaa saldoa
                      </button>
                      <button onClick={() => handleDeleteProduct(product)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        🗑️ Poista tuote
                      </button>
                    </div>

                  </div>
                ))}
                {adminFilteredProducts.length === 0 && <p style={{ color: '#94a3b8' }}>Ei tuotteita tällä hakusanalla.</p>}
              </div>

            </div>
          )}

          {adminTab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Hae sähköpostilla, tuotteella tai toiveen tekstillä..." 
                  value={orderSearch} 
                  onChange={(e) => setOrderSearch(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '1rem' }} 
                />
              </div>

              <div>
                <h2 style={{ color: '#f59e0b', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>1. Uudet toiveet (Harkinnassa)</h2>
                {pendingOrders.length === 0 ? <p style={{ color: '#94a3b8' }}>Ei uusia toiveita.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                    {pendingOrders.map(order => renderOrderCard(order, (
                      <>
                        <button onClick={() => updateOrderStatus(order.real_id, 'rejected')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}>Hylkää</button>
                        <button onClick={() => updateOrderStatus(order.real_id, 'approved')} style={{ padding: '8px 16px', background: '#38bdf8', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Hyväksy (Jatka)</button>
                      </>
                    )))}
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ color: '#38bdf8', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>2. Hyväksytyt (Odottaa mantereelta tilaamista)</h2>
                {approvedOrders.length === 0 ? <p style={{ color: '#94a3b8' }}>Ei odottavia tilauksia.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                    {approvedOrders.map(order => renderOrderCard(order, (
                      <button onClick={() => updateOrderStatus(order.real_id, 'ordered')} style={{ padding: '8px 16px', background: '#f59e0b', border: 'none', color: '#0f172a', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Merkitse tilatuksi</button>
                    )))}
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ color: '#10b981', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>3. Tilauksessa (Matkalla saareen)</h2>
                {orderedOrders.length === 0 ? <p style={{ color: '#94a3b8' }}>Ei matkalla olevia tilauksia.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                    {orderedOrders.map(order => renderOrderCard(order, (
                      <button onClick={() => updateOrderStatus(order.real_id, 'arrived')} style={{ padding: '8px 16px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Merkitse saapuneeksi</button>
                    )))}
                  </div>
                )}
              </div>

              {Object.keys(groupedArchive).length > 0 && (
                <div style={{ opacity: 0.8 }}>
                  <h2 style={{ color: '#94a3b8', borderBottom: '2px solid #334155', paddingBottom: '10px', marginBottom: '15px' }}>4. Arkisto (Historianäkymä)</h2>
                  
                  {Object.entries(groupedArchive).map(([monthName, monthOrders]) => (
                    <details key={monthName} style={{ marginBottom: '10px', backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
                      <summary style={{ padding: '15px', color: '#f8fafc', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{monthName}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>{monthOrders.length} toivetta</span>
                      </summary>
                      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#0f172a' }}>
                        {monthOrders.map(order => renderOrderCard(order, (
                          <span style={{ padding: '6px 12px', borderRadius: '6px', color: order.status === 'arrived' ? '#94a3b8' : '#ef4444', backgroundColor: order.status === 'arrived' ? '#1e293b' : '#ef444420', fontWeight: 'bold' }}>
                            {order.status === 'arrived' ? '✅ Tilaus suoritettu' : '❌ Hylätty toive'}
                          </span>
                        )))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          {adminTab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h2 style={{ marginBottom: '10px', color: '#f8fafc' }}>Käyttäjien hallinta</h2>
              {users.map(u => {
                if (role === 'kauppias' && (u.role === 'admin' || u.role === 'kauppias')) return null;
                
                return (
                  <div key={u.id} className="product-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: u.role === 'odottaa' ? '4px solid #f59e0b' : 'none' }}>
                    <div>
                      <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1.1rem', display: 'block' }}>{u.email}</span>
                      {u.role === 'odottaa' && <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Odottaa hyväksyntää</span>}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {role === 'admin' ? (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <select 
                            value={selectedRoles[u.id] || u.role} 
                            onChange={(e) => setSelectedRoles({...selectedRoles, [u.id]: e.target.value})} 
                            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontWeight: 'bold' }}
                          >
                            <option value="odottaa">Odottaa</option>
                            <option value="asiakas">Asiakas</option>
                            <option value="kauppias">Kauppias</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => { const newRole = selectedRoles[u.id] || u.role; updateUserRole(u.id, newRole); alert(`Päivitetty!`); }} style={{ padding: '8px 16px', background: '#38bdf8', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Tallenna
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {u.role === 'odottaa' && (
                            <button onClick={() => updateUserRole(u.id, 'asiakas')} style={{ padding: '8px 16px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                              Hyväksy
                            </button>
                          )}
                          {u.role === 'asiakas' && (
                            <button onClick={() => updateUserRole(u.id, 'odottaa')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}>
                              Estä
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    );
  }
}

export default App;

import { createRoot } from 'react-dom/client';
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}