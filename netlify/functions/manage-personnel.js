const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://fnwikxmspdxamsostbnb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tlsSFNjL-zfH-KUWShqIkQ_H5G97Hvd";

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Oturum bilgisi bulunamadı. Lütfen giriş yapın.' })
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = JSON.parse(event.body);
    const { action } = payload;

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Eylem (action) belirtilmelidir.' })
      };
    }

    // 1. İstek Yapan Kullanıcıyı Doğrula
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Kullanıcı doğrulama hatası:', authError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Geçersiz oturum.' })
      };
    }

    // 2. Admin Kontrolü
    const isAdmin = user.email.toLowerCase().startsWith('admin');
    if (!isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Yetkisiz erişim. Bu işlemi sadece yöneticiler yapabilir.' })
      };
    }

    // 3. Service Role Key ile Admin Client Başlat
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY tanımlanmamış.');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Sunucu yapılandırma hatası: Admin anahtarı bulunamadı.' })
      };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 4. Eyleme Göre İşlemi Gerçekleştir
    if (action === 'create') {
      const { name, email, password, isAdmin: isStaffAdmin, photo } = payload;

      if (!name || !email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ad Soyad, E-posta ve Şifre zorunludur.' })
        };
      }

      // Supabase Auth üzerinde yeni kullanıcı oluştur
      const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      });

      if (createUserError) {
        console.error('Auth kullanıcı oluşturma hatası:', createUserError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Hesap oluşturulurken hata: ' + createUserError.message })
        };
      }

      // Profiles tablosuna kayıt ekle
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .insert([{
          name: name,
          email: email,
          is_admin: !!isStaffAdmin,
          photo: photo || null,
          user_id: authUser.user.id
        }]);

      if (dbError) {
        console.error('Veritabanı profil ekleme hatası:', dbError);
        // Rollback: Auth kullanıcısını temizle
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Profil kaydedilirken hata oluştu, işlem iptal edildi: ' + dbError.message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `"${name}" personeli başarıyla oluşturuldu.` })
      };

    } else if (action === 'update') {
      const { id, name, email, password, isAdmin: isStaffAdmin, photo } = payload;

      if (!id || !name || !email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Profil ID, Ad Soyad ve E-posta zorunludur.' })
        };
      }

      // 1. Mevcut profili veritabanından çek
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !profile) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Güncellenecek profil bulunamadı.' })
        };
      }

      // 2. Auth kullanıcısını güncelle (eğer user_id varsa)
      if (profile.user_id) {
        const updateParams = { email: email };
        if (password) {
          updateParams.password = password;
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          profile.user_id,
          updateParams
        );

        if (authUpdateError) {
          console.error('Auth kullanıcı güncelleme hatası:', authUpdateError);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Auth bilgileri güncellenemedi: ' + authUpdateError.message })
          };
        }
      }

      // 3. Profiles tablosundaki kaydı güncelle
      const updateData = {
        name: name,
        email: email,
        is_admin: !!isStaffAdmin
      };
      
      // Fotoğraf geldiyse güncelle (gelmediyse mevcut olanı koru)
      if (photo !== undefined) {
        updateData.photo = photo;
      }

      const { error: dbUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', id);

      if (dbUpdateError) {
        console.error('Veritabanı profil güncelleme hatası:', dbUpdateError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Profil bilgileri güncellenirken hata oluştu: ' + dbUpdateError.message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `"${name}" personeli başarıyla güncellendi.` })
      };

    } else if (action === 'delete') {
      const { id } = payload;

      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Silinecek profil ID\'si gereklidir.' })
        };
      }

      // 1. Profili çek
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !profile) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Silinecek profil bulunamadı.' })
        };
      }

      // 2. Auth kullanıcısını sil
      if (profile.user_id) {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
        if (authDeleteError) {
          console.error('Auth silme hatası (Muhtemelen kullanıcı önceden silindi):', authDeleteError);
        }
      }

      // 3. Profiles tablosundan kaydı sil
      const { error: dbDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', id);

      if (dbDeleteError) {
        console.error('Veritabanı profil silme hatası:', dbDeleteError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Profil silinirken hata oluştu: ' + dbDeleteError.message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `Personel başarıyla silindi.` })
      };

    } else if (action === 'change-password') {
      const { targetEmail, newPassword } = payload;

      if (!targetEmail || !newPassword) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Hedef e-posta ve yeni şifre belirtilmelidir.' })
        };
      }

      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const targetUser = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
      if (!targetUser) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `"${targetEmail}" kullanıcısı bulunamadı.` })
        };
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, { password: newPassword });
      if (updateError) throw updateError;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Şifre başarıyla güncellendi.' })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Geçersiz eylem (action).' })
    };

  } catch (error) {
    console.error('İşlem hatası:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Sunucu hatası oluştu: ' + error.message })
    };
  }
};
