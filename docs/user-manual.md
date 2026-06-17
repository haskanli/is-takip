# Corject Kullanıcı Kılavuzu

Bu kılavuz Corject uygulamasını son kullanıcı bakışıyla anlatır. Amaç, kullanıcıların hangi ekranı neden kullanacağını, hangi alanların ne işe yaradığını ve günlük iş akışlarında nasıl ilerleyeceğini netleştirmektir.

## 1. Genel Bakış

Corject; proje yönetimi, saha planlama, görev takibi, ticket yönetimi, raporlama, efor takibi ve yönetici karar ekranlarını tek uygulamada birleştiren bir operasyon takip sistemidir.

Uygulama temel olarak şu işleri destekler:

- Proje portföyünü takip etmek
- Milestone ve görevleri yönetmek
- Kişisel To-Do ve aksiyonları kaydetmek
- Saha ziyaretlerini ve uzaktan çalışmaları planlamak
- Ticketları, Jira ilişkilerini ve müşteri onay süreçlerini izlemek
- Devreye alınan makineleri ve hiyerarşik devreye alma kapsamını takip etmek
- Uzaktan erişim, müşteri kontakları, eğitim, doküman ve maliyet bilgilerini proje içinde tutmak
- Yönetici seviyesinde KPI, risk, gecikme, ekip yükü ve raporları izlemek
- E-posta, Slack, WhatsApp ve Jira entegrasyonlarıyla bildirimleri otomatikleştirmek

## 2. Kullanıcı Rolleri ve Yetkiler

### 2.1 Ekip Üyesi

Ekip üyesi kendi işleri, dahil olduğu projeler, kendisine atanmış görevler, To-Do kayıtları, saha planı ve ticketları takip eder.

Ekip üyesi şunları yapabilir:

- Dashboard üzerinden günlük akışını görebilir
- Kendi To-Do kayıtlarını oluşturabilir
- Kendi görevlerini tamamlandı, bekliyor veya devam ediyor gibi durumlara alabilir
- Göreve yorum ve efor girebilir
- Dahil olduğu projelerde aksiyon, saha notu ve efor girişi yapabilir
- Kendi saha planını oluşturabilir
- Kendisine atanmış ticketları görebilir

### 2.2 Proje Yöneticisi / Proje Katılımcısı

Proje yöneticisi veya projeye sorumlulukla dahil edilmiş kişi, ilgili projenin kapsamını ve operasyonel kayıtlarını yönetir.

Bu kullanıcılar şunları yapabilir:

- Proje görevlerini ve milestone içeriklerini düzenlemek
- Proje aksiyonlarını kaydetmek
- Proje kontaklarını ve RACI bilgilerini takip etmek
- Makineleri, devreye alma kayıtlarını ve saha ziyaretlerini güncellemek
- Proje raporlarını almak
- Proje uzaktan erişim kayıtlarını görüntülemek

### 2.3 Yönetici

Yönetici tüm portföyü, tüm projeleri, ekip üyelerini, organizasyonu, raporları ve operasyonel KPI'ları görebilir.

Yönetici şunları yapabilir:

- Yönetici dashboardunu kullanmak
- Tüm projeleri görmek ve proje silmek
- Kullanıcı eklemek, düzenlemek ve yetki vermek
- Organizasyonel hiyerarşiyi yönetmek
- Genel görev atamak
- Bir görevi birden fazla kişiye ayrı ayrı atamak
- Periyodik görev oluşturmak
- Genel durum, ticket, efor, kapasite ve risk raporlarını almak
- Mail şablonları ve rapor otomasyonlarını yönetmek

### 2.4 Sadece Ticket Kullanıcısı

Bazı kullanıcılar yalnızca ticket ekranına erişecek şekilde sınırlandırılabilir.

Bu kullanıcılar:

- Ticketları görebilir
- Kendilerine atanmış veya yetkili oldukları ticketlarda durum takibi yapabilir
- Gerektiğinde ticket detayına girip açıklama, statü ve Jira bilgilerini takip edebilir

## 3. Giriş ve Oturum

### 3.1 Slack ile Giriş

Canlı ortamda temel giriş yöntemi Slack hesabıdır. Giriş ekranında Slack ile giriş seçilir ve Slack hesabı üzerinden doğrulama yapılır.

Kullanım senaryosu:

1. Kullanıcı giriş sayfasını açar.
2. Slack ile giriş butonuna tıklar.
3. Slack doğrulaması tamamlanır.
4. Kullanıcının e-posta adresi sistemdeki kullanıcı kaydıyla eşleşirse uygulama açılır.

### 3.2 Mail ile Giriş

Mail ile giriş seçeneği alternatif yöntem olarak bulunur. Kullanıcı e-posta adresini girer ve kendisine gelen bağlantı üzerinden oturum açar.

Not: Mail linklerinin doğru domaine gitmesi için canlı domain ayarlarının doğru olması gerekir.

### 3.3 Profil Fotoğrafı

Slack ile giriş yapan kullanıcılarda Slack profil fotoğrafı Corject profil fotoğrafı olarak kullanılabilir. Profil fotoğrafı üst barda ve kullanıcı listelerinde görünür.

### 3.4 Profil Ayarları

Profil düzenleme ekranından şu bilgiler güncellenebilir:

- Ad soyad
- E-posta
- WhatsApp telefonu
- İl ve ilçe
- WhatsApp görev bildirimi tercihi
- Yetkisi varsa alt ana sayfa tercihi

Alt ana sayfa tercihi sayesinde yönetici yetkisi olan kullanıcı, uygulamaya girdiğinde ekip dashboardu veya yönetici dashboardu ile başlamayı seçebilir.

## 4. Ana Navigasyon

### 4.1 Web Sol Menü

Web görünümünde sol menü ana modüllere erişim sağlar.

Başlıca menüler:

- Dashboard
- Yönetim
- To-Do
- Projeler
- Görevlerim
- Saha Yönetimi
- Termin Uyarıları
- Ticketlar
- AI Asistan
- Import Merkezi
- Mail Merkezi
- Raporlar
- Ekip
- Aktivite

### 4.2 Mobil Alt Menü

Mobil görünümde alt menü hızlı erişim için kullanılır.

Alt menüde:

- Ana
- Projeler
- Ekle
- İşler
- Ticket

Orta `Ekle` butonu hızlı kayıt panelini açar. Bu panelden To-Do, aksiyon, ticket veya saha planı eklenebilir.

### 4.3 Mobil Tüm Özellikler Menüsü

Mobilde sağ üstte profil fotoğrafının yanında üç çizgili menü bulunur. Bu menü, web tarafındaki daha geniş modüllere mobilde erişmek için kullanılır.

Bu menüden şunlara gidilebilir:

- Ticketlar
- Raporlar
- AI Tool
- Saha Yönetimi
- Termin Uyarıları
- To-Do
- Ekip
- Yönetici paneli
- Import Merkezi
- Mail Merkezi

## 5. Dashboard

Dashboard kullanıcının günlük iş akışına hızlı başlaması için tasarlanmıştır.

### 5.1 Ekip Dashboardu

Amaç: Kullanıcının kendi işleri, planları, To-Do kayıtları, ticketları ve projelerine tek bakışta erişmesini sağlamak.

Erişim: Tüm kullanıcılar.

Ana alanlar:

- Hızlı To-Do
- Hızlı Aksiyon
- To-Do sayacı
- Projelerim
- Görevlerim
- Saha Yönetimi
- Ticketlarım
- Termin Uyarıları
- AI Asistan
- Raporlar
- Yaklaşan çalışma planları
- Yaklaşan To-Do kayıtları
- Projelerim listesi

Örnek senaryo:

Bir saha mühendisi sabah uygulamayı açar, bugünkü saha ziyaretini görür, geciken To-Do var mı kontrol eder ve bir müşteri görüşmesini hızlı aksiyon olarak kaydeder.

### 5.2 Mobil Dashboard

Mobil dashboard sahadaki hızlı kullanım için sadeleştirilmiştir.

Sıralama:

1. Kare hızlı erişim kutuları
2. AI bugünün akışı özeti
3. To-Do kayıtları
4. Yaklaşan planlar
5. Projeler

AI bugünün akışı kartı gün içinde bir kez gösterilir. Kullanıcı isterse kapatabilir; ertesi gün yeniden görünür.

### 5.3 Yönetici Dashboardu

Amaç: Yöneticiye portföy sağlığı, gecikmeler, riskler, ticketlar, ekip yükü ve raporları tek ekranda sunmak.

Erişim: Yalnızca yönetici yetkisi olan kullanıcılar.

Ana kartlar:

- Portföy sağlığı
- Genel ilerleme
- Kritik terminler
- Açık ticketlar
- Açık riskler
- Toplam efor
- Devreye alma ilerlemesi
- Aktif proje sayısı
- Proje sağlık haritası
- Portföy dağılımı
- Ticket durumları
- Kritik termin listesi
- Ekip iş yükü
- Risk ve aksiyon radarı
- AI portföy asistanı
- Yönetici rapor merkezi

Kartlar sürükle-bırak ile kişiye özel sıralanabilir. Kart boyutları da kullanıcıya özel saklanır.

Örnek senaryo:

Operasyon direktörü haftalık toplantı öncesi yönetici dashboardunu açar, kritik terminleri ve aksiyonsuz ticketları kontrol eder, ardından genel durum raporunu indirir.

### 5.4 Yönetici Çalışma Alanı

Yönetici sekmesi dashboard dışında ekip yönetimi ve atanan işler takibi için de kullanılır.

Ana bölümler:

- Yönetici dashboardu
- Atadığım işler
- Organizasyon

Atadığım işler bölümünde yönetici kendi oluşturduğu genel görevleri, bu görevlerin kimde olduğunu ve tamamlanma durumlarını takip eder.

Organizasyon bölümünde kişiler seviyelere göre listelenir veya ağaç görünümünde izlenir. Bu yapı sayesinde CEO, COO, Operasyon Direktörü, Proje Müdürü, Proje Yöneticisi, Süreç Lideri ve Saha Mühendisi kırılımı sistem içinde görülebilir.

## 6. To-Do

Amaç: Kullanıcının kendisine özel küçük aksiyonlarını müşteri, termin ve yapılacak iş olarak takip etmesi.

Erişim: Tüm kullanıcılar.

Alanlar:

- Proje / Müşteri
- Müşteri adı
- Termin
- Aksiyon

Kullanıcı işlemleri:

- To-Do ekleme
- To-Do düzenleme
- To-Do silme
- Tamamlandı işaretleme
- Geciken To-Do kayıtlarını termin uyarılarında görme
- İstenirse To-Do kaydını proje aksiyonuna gönderme

Örnek senaryo:

Kullanıcı "ABC müşterisiyle lisans konusunu görüş" şeklinde bir To-Do girer. Termin geçerse bu kayıt kullanıcının termin uyarılarında To-Do etiketiyle görünür.

## 7. Projeler

### 7.1 Proje Listesi

Amaç: Sistemdeki projeleri görüntülemek, filtrelemek ve proje detayına girmek.

Erişim: Tüm kullanıcılar. Yönetici tüm projeleri görür; ekip üyeleri kendilerine açık olan projeleri görür.

Kullanıcı işlemleri:

- Proje arama
- Proje kartına tıklayarak detay açma
- Proje düzenleme
- HTML rapor alma
- Proje silme

Proje silme yetkisi yalnızca yöneticidedir.

### 7.2 Proje Oluşturma

Proje oluştururken kullanıcı hazır MES şablonlarından başlayabilir veya boş proje oluşturabilir.

Alanlar:

- Proje adı
- Açıklama
- Proje yöneticileri
- Proje rolleri ve katılımcılar
- Müşteri kontakları
- Hiyerarşik devreye alma takibi seçimi
- Renk
- Başlangıç tarihi
- Bitiş tarihi
- Durum

Örnek senaryo:

Yeni bir MES projesi başlatılırken kullanıcı hazır şablon seçer. Sistem milestone ve görevleri otomatik oluşturur; başlangıç tarihi seçildiğinde görev tarihleri şablona göre yerleşir.

## 8. Proje Detay Ekranı

Proje detay ekranı proje içindeki tüm operasyonel bilgilerin toplandığı alandır.

Üst bölümde müşteri/proje kartı bulunur. Bu kartta müşteri adı, logo, web sitesi, PM bilgisi ve temel proje bilgileri gösterilir. Kart ok ile genişletildiğinde ek detaylar görünür.

Sekmeler:

- Proje Bilgileri
- Proje Planı
- Görevler
- Ticketlar
- Aksiyon
- Riskler
- Notlar
- Log

Mobilde kullanıcı telefonun geri hareketiyle proje detayından listeye dönebilir.

## 9. Proje Bilgileri

Proje Bilgileri sekmesi projeye ait temel tanımların ve yardımcı kayıtların bulunduğu merkezdir.

Alt alanlar:

- Özet / müşteri bilgileri
- Başlangıç sağlığı
- Müşteri kontakları ve RACI
- Sorumluluk dağılımı
- Uzaktan erişim kasası
- Eğitimler
- Dokümanlar
- Proje maliyeti
- Proje efor merkezi
- Makine devreye alma
- Hiyerarşik devreye alma takibi
- Proje rapor otomasyonları
- AI proje yorumu

### 9.1 Proje Özet Bilgileri

Amaç: Projeyi kartvizit gibi tanımlamak.

Alanlar:

- Müşteri / proje adı
- Müşteri logosu
- Müşteri web sitesi
- Konum
- Aktif modüller
- Başlangıç tarihi
- Hedef bitiş tarihi
- PM ve proje rolleri

Konum girildiğinde kullanıcı harita üzerinden yol tarifi alabilir.

### 9.2 Başlangıç Sağlığı

Amaç: Projeye başlamadan önce MES projesi için gerekli hazırlık seviyesini ölçmek.

Erişim: Proje yetkilileri ve yöneticiler düzenleyebilir; diğer kullanıcılar görüntüler.

Kontrol başlıkları örnek olarak şunları içerir:

- Kapsam ve hedef netliği
- Müşteri sorumluları
- Veri kaynakları
- Entegrasyon hazırlığı
- Sunucu ve ağ erişimi
- Makine / hat listesi
- Test ve kabul kriterleri

Sistem bir skor üretir. Skor 80'in altındaysa proje başlamaya elverişli değil uyarısı verilir.

Kullanıcı işlemleri:

- Kontrol maddesi durumunu işaretleme
- Açıklama ekleme
- Gerekirse checklist maddelerini düzenleme

### 9.3 Müşteri Kontakları ve RACI

Amaç: Proje iletişimindeki sorumlulukları netleştirmek.

Alanlar:

- Ad soyad
- Unvan
- E-posta
- Telefon
- RACI rolü
- Şirket içi veya müşteri tarafı bilgisi

RACI anlamları:

- Responsible: işi yapan sorumlu kişi
- Accountable: nihai hesap veren kişi
- Consulted: görüşü alınacak kişi
- Informed: bilgilendirilecek kişi

Örnek senaryo:

Proje ilerleme maili gönderilecekse, sistem ilgili kişileri RACI yapısına göre belirlemeye uygun şekilde bilgileri tutar.

### 9.4 Sorumluluk Dağılımı

Amaç: Projede kalan işin hangi ekip veya paydaş üzerinde olduğunu göstermek.

Sistem görevlerin sorumluluk grubuna ve durumuna bakarak dağılım üretir.

Sorumluluk grupları:

- Proje Ekibi
- Ürün Ekibi
- Yazılım Ekibi
- Müşteri
- Tedarikçi
- Diğer

Kullanıcı işlemleri:

- Dağılım kartına tıklayarak ilgili grubun görevlerini filtreleme
- Kalan işin hangi ekipte yoğunlaştığını görme
- Müşteri veya ürün ekibinde bekleyen işleri toplantılarda gündeme alma

Örnek:

Bir anda kalan işin %80'i müşteride görünüyorsa PM müşteri tarafındaki veri, onay veya erişim bekleyen konuları önceliklendirir.

### 9.5 Uzaktan Erişim Kasası

Amaç: Projeye ait VPN, sunucu, kullanıcı adı, parola ve yönlendirme bilgilerini güvenli şekilde saklamak.

Erişim:

- Projeye dahil kullanıcılar görüntüleyebilir
- Proje yöneticileri ve yöneticiler düzenleyebilir

Alanlar:

- Sistem / sunucu adı
- Bağlantı adresi
- Kullanıcı adı
- Parola
- VPN / yönlendirme bilgisi
- Durum
- Not

Kullanıcı işlemleri:

- Kayıt ekleme
- Kayıt düzenleme
- Kayıt silme
- Kullanıcı adı, adres veya parolayı kopyalama
- Parolayı göster/gizle

### 9.6 Eğitimler

Amaç: Projede verilen eğitimleri kayıt altına almak.

Eğitim kapsamları:

- Operatör Eğitimi
- Yönetici Eğitimi
- Hatırlatma Eğitimi
- Proje Devri Eğitimi
- Süper Kullanıcı Eğitimi
- Teknik Eğitim
- Diğer

Alanlar:

- Eğitim başlığı
- Kapsam
- Tarih
- Katılımcılar
- Eğitmen
- Notlar

Örnek senaryo:

Canlı geçiş öncesi operatör eğitimi verilir. Eğitim tarihi, katılımcılar ve notlar proje içinde tutulur.

### 9.7 Dokümanlar

Amaç: Projeye ait dokümanları ve bağlantıları etiketli şekilde saklamak.

Alanlar:

- Doküman adı
- Bağlantı
- Etiket
- Açıklama

Kullanım:

OneDrive veya başka doküman sisteminde tutulan dosyanın linki eklenebilir. Böylece Corject doküman merkezi gibi davranır.

### 9.8 Proje Maliyeti

Amaç: Projeye ait maliyetleri kalem kalem izlemek.

Maliyet kategorileri:

- Saha yakıt
- Yetkili servis işçilik
- Donanım
- Lisans
- Konaklama
- Ulaşım
- Diğer

Saha ziyaretlerinde yakıt maliyeti; kilometre, yakıt tüketimi, yakıt fiyatı ve kur bilgisine göre hesaplanabilir.

### 9.9 Proje Efor Merkezi

Amaç: Projede nereden girilirse girilsin tüm eforları tek yerde toplamak.

Efor kaynakları:

- Görev eforları
- Aksiyon eforları
- Saha ziyareti eforları
- Uzaktan çalışma eforları

Kullanıcı işlemleri:

- Toplam eforu görüntüleme
- Planlanan ve gerçekleşen eforu karşılaştırma
- Kişi bazlı dağılımı görme
- XLSX olarak indirme

### 9.10 Makine Devreye Alma

Amaç: Projede devreye alınan veya alınacak makineleri yönetmek.

Alanlar:

- Makine adı
- Kod / hat no
- IP adresi
- İşletim sistemi / model
- Ek lisans
- Fiziksel / sanal bilgisi
- Devreye alındı işareti
- Devreye alma tarihi
- Devreye alınamama açıklaması / not

Görünümler:

- Kart görünümü
- Liste görünümü

Liste görünümünde makine adı, kodu, işletim sistemi/model, IP, fiziksel/sanal bilgisi ve durum görünür. IP adresi tek tıkla kopyalanabilir.

Kullanıcı işlemleri:

- Makine ekleme
- Makine düzenleme
- Makine silme
- Devreye al / devreden çıkar
- Excel içe aktarma
- Excel dışa aktarma
- Arama yapma

### 9.11 Hiyerarşik Devreye Alma Takibi

Amaç: Büyük projelerde devreye alma kapsamını sektör, üretim merkezi, işyeri, hat ve makine seviyesinde takip etmek.

Hiyerarşi:

1. Sektör
2. Üretim merkezi
3. İşyeri
4. Hat
5. Makine

Alanlar:

- Sektör
- Üretim merkezi
- İşyeri
- Hat
- Makine adı
- Makine kodu
- Fiziksel / sanal
- Devreye alındı
- Açıklama

Kullanıcı işlemleri:

- Kayıt ekleme
- Kayıt düzenleme
- Devreye alma işaretleme
- Tamamlanma yüzdesini izleme
- Excel içe aktarma
- Excel dışa aktarma
- Tamamlanan / bekleyen filtreleme

### 9.12 Proje Rapor Otomasyonları

Amaç: Belirli proje raporlarının belirlenen kişilere otomatik gönderilmesini sağlamak.

Alanlar:

- Rapor türü
- Alıcılar
- Sıklık
- Gönderim saati
- Aktif / pasif durumu
- Son gönderim sonucu

Kullanıcı işlemleri:

- Otomatik rapor planı oluşturma
- Planı aktif veya pasif yapma
- Gönderim logunu kontrol etme
- Hata varsa alıcı, saat veya mail ayarını düzeltme

Örnek:

Bir müşteri projesi için her pazartesi 09:00'da proje durum raporu müşteri sponsoruna ve PM'e otomatik gönderilecek şekilde planlanır.

## 10. Proje Planı

Amaç: Proje milestone ve görevlerini tarihsel planda görmek.

Erişim: Projeyi görebilen tüm kullanıcılar.

İçerik:

- Milestone listesi
- Görev başlangıç tarihleri
- Görev terminleri
- Durumlar
- Gantt benzeri zaman çizelgesi

Milestone durumu görevlerden hesaplanır:

- İçindeki hiçbir görev başlamadıysa: Başlamadı
- Herhangi bir görev devam ediyorsa: Devam Ediyor
- Tüm görevler tamamlandıysa: Tamamlandı
- Bekleyen veya engellenen görevler varsa: ilgili duruma göre görünür

Örnek senaryo:

Proje yöneticisi plan ekranında geciken işleri görür, göreve tıklar ve sorumlu kişiyle aksiyon alır.

## 11. Görevler

Amaç: Proje içindeki milestone görevlerini yönetmek.

Alanlar:

- Görev başlığı
- Durum
- Öncelik
- Sorumlu kişi
- Sorumluluk grubu
- Planlanan efor
- Başlangıç tarihi
- Termin tarihi
- Bekleme kaynağı
- Bekleme sebebi
- Not
- Jira linki

Durumlar:

- Başlamadı
- Bekliyor
- Devam Ediyor
- Tamamlandı
- Engellendi

Kullanıcı işlemleri:

- Milestone seçme
- Görev ekleme
- Görev düzenleme
- Görev silme
- Görev tamamlama
- Göreve efor girişi yapma
- Bekleme sebebi kaydetme
- Jira linki ekleme
- Görev detayında yorum yazma

Örnek senaryo:

Bir görev müşteriden veri beklediği için beklemeye alınır. Kullanıcı bekleme kaynağını "Müşteri" seçer ve sebep girer. Daha sonra bu bekleme geçmişi görev üzerinde izlenir.

## 12. Görevlerim

Amaç: Kullanıcının kendi işlerini tek ekranda takip etmesi.

Erişim: Tüm kullanıcılar.

Sekmeler:

- Tümü
- Yöneticinin Atadıkları
- Projeden Gelenler
- Kendi To-Do'larım
- Notlarım

Kullanıcı işlemleri:

- Genel görev ekleme
- Görevi tamamlandı işaretleme
- Efor girişi yapma
- Görev detayını açma
- Yorum ekleme
- Not tutma

Yönetici ek özellikleri:

- Başkasına görev atama
- Aynı görevi birden fazla kişiye ayrı görev olarak atama
- Periyodik görev tanımlama
- Tüm genel görevleri görme

Bildirim:

Yönetici bir kullanıcıya görev atadığında Slack, WhatsApp veya e-posta bildirimi gönderilebilir. Bildirimdeki link ilgili görevi açar.

## 13. Aksiyonlar

Amaç: Projede yapılan görüşme, yazışma, toplantı, karar, saha notu ve sistem kontrollerini kayıt altına almak.

Erişim: Projeye dahil kullanıcılar görebilir; yetkili kullanıcılar ekleyebilir.

Alanlar:

- Aksiyon türü
- Aksiyon metni
- Efor
- Tarih
- Kullanıcı

Aksiyon türleri:

- Toplantı
- Telefon / Görüşme
- Yazışma
- Sistem Kontrolü
- Saha Ziyareti
- Takip
- Karar
- Bilgilendirme
- Diğer

Kullanıcı işlemleri:

- Aksiyon ekleme
- Aksiyon filtreleme
- Efor girme
- Saha ziyareti veya uzaktan çalışma notlarını aksiyonlarda görme
- Kişisel To-Do'yu aksiyona gönderme

Örnek senaryo:

PM müşteriyle telefon görüşmesi yapar. Aksiyon türünü "Telefon / Görüşme" seçer, görüşme notunu yazar ve 0.5 saat efor girer.

## 14. Riskler

Amaç: Projedeki risk ve engelleri takip etmek.

Alanlar:

- Risk başlığı
- Seviye
- Durum
- Not

Seviyeler:

- Düşük
- Orta
- Yüksek

Durumlar:

- Açık
- İzleniyor
- Kapalı

Kullanıcı işlemleri:

- Risk ekleme
- Risk durumunu değiştirme
- Risk silme

## 15. Notlar ve Log

### 15.1 Proje Notları

Amaç: Projeye ait serbest notları ve yardımcı kayıtları tutmak.

Not: Uzaktan erişim ayrı bir proje bilgisi alanı olarak yönetilir; notlar içinde saklanmaz.

### 15.2 Proje Log

Amaç: Projede yapılan değişikliklerin geçmişini göstermek.

Log kayıtları:

- Görev tamamlandı
- Görev eklendi
- Görev silindi
- Durum değişti
- Risk eklendi
- Proje oluşturuldu
- Import işlemi

## 16. Saha Yönetimi

Saha Yönetimi iki ana alandan oluşur:

- Haftalık Plan
- Gerçekleşen Çalışmalar

### 16.1 Haftalık Plan

Amaç: Kullanıcının hangi gün hangi proje için sahaya gideceğini veya uzaktan çalışacağını planlaması.

Alanlar:

- Personel
- Çalışma türü
- Müşteri / proje
- Tarih
- Başlangıç saati
- Bitiş saati
- Not

Çalışma türleri:

- Saha ziyareti
- Uzaktan çalışma

Kullanıcı işlemleri:

- Gün seçerek plan ekleme
- Plan düzenleme
- Plan silme
- Saha planını tamamlandıya alma

Yönetici ek özellikleri:

- Tüm ekibin planını görme
- Seçilen kişinin planını filtreleme

### 16.2 Gerçekleşen Çalışmalar

Amaç: Tamamlanan saha ziyaretlerini ve uzaktan çalışmaları efor ve notlarıyla takip etmek.

Alanlar:

- Proje
- Kişi
- Tarih
- Saat aralığı
- Efor
- Gidiş-dönüş kilometre
- Yakıt maliyeti
- Yapılanlar notu

Yakıt maliyeti:

Saha ziyareti tamamlandığında çalışan konumu ile müşteri konumu arasındaki mesafe gidiş-dönüş olarak hesaplanabilir. Ortalama tüketim, yakıt fiyatı ve kur bilgisiyle dolar ve TL karşılığı gösterilir.

## 17. Ticket Yönetimi

Ticketlar hem proje içinde hem de global Ticketlar ekranında yönetilebilir.

### 17.1 Ticket Numarası

Her ticket `CJT-1`, `CJT-2` gibi artan sıra numarası alır.

### 17.2 Ticket Durumları

Desteklenen durumlar:

- Açık
- Operasyon İncelemesinde
- Ürün Değerlendirmesinde
- Jira'da Çalışılıyor
- Operasyon Testinde
- Test Başarısız
- Yayına Hazır
- Müşteri Onayında
- Müşteri Reddetti
- Tamamlandı
- Beklemede
- İptal Edildi

### 17.3 Ticket Alanları

- Başlık
- Açıklama
- Tip
- Kategori
- Öncelik
- Atanan kişi
- Durum
- Jira Task Key
- Kök neden
- Kalıcı çözüm
- Efor
- Müşteri onayı

### 17.4 Global Ticketlar Ekranı

Amaç: Tüm projelerdeki ticketları tek ekranda takip etmek.

Erişim: Tüm kullanıcılar. Yönetici tüm ticketları, ekip üyesi kendi ilişkili ticketlarını görebilir.

Filtreler:

- Arama
- Ticketlarım
- Proje
- Durum

Sekmeler:

- Ticket Takibi
- Tekrar Eden Problemler

Kullanıcı işlemleri:

- Ticket ekleme
- Ticket detayını açma
- Kart üzerinden durum değiştirme
- Ticket silme
- Durum raporu alma
- Tekrar eden problem listesini görme

### 17.5 Ticket İş Akışı

Önerilen operasyonel akış:

1. Ticket müşteri veya operasyon ekibi tarafından açılır.
2. Operasyonel değilse kategoriye göre ürün ekibine atanır.
3. Ürün ekibi değerlendirir ve Jira taskı ile ilişkilendirir.
4. Jira'da iş test aşamasına geldiğinde Corject'te ticket operasyon testine döner.
5. Operasyon test eder.
6. Test başarısızsa ürün ekibine geri döner.
7. Test başarılıysa Yayına Hazır olur.
8. Yayın sonrası ürün ekibi Jira'yı Done yapar.
9. Corject ticketı Tamamlandı durumuna geçer.
10. Gerekirse müşteri onayı beklenir.

Her önemli değişiklik ticket geçmişine kaydedilir.

### 17.6 Müşteri Onayı

Ticket tamamlanmadan önce müşteri onayı beklenebilir.

Durumlar:

- Henüz istenmedi
- Onay bekleniyor
- Onaylandı
- Reddedildi

## 18. Tekrar Eden Problemler

Amaç: Projelerde tekrar eden sorunları belirlemek ve tekrar tekrar aynı eforun harcanmasını önlemek.

Sistem ticket bilgilerinden tekrar kodu, kök neden, çözüm ve efor kayıtlarını izlemeye uygundur.

Kullanım önerisi:

- Aynı tür sorunlara aynı tekrar kodu verin
- Kök neden ve kalıcı çözümü ticket detayına yazın
- Eforu kaydedin
- Tekrar eden problemler sekmesinden en çok tekrar eden konuları izleyin

Örnek:

"OPC bağlantı kopması" farklı projelerde tekrar ediyorsa aynı tekrar koduyla işaretlenir. Yönetici bu tekrarları görerek standart çözüm dokümanı veya ürün geliştirme ihtiyacı çıkarır.

## 19. AI Asistan

Amaç: Proje veya tüm portföy verileri üzerinden kısa analiz ve aksiyon önerisi almak.

Erişim: Tüm kullanıcılar, yetkileri dahilindeki projeler için.

Kapsam:

- Tek proje
- Tüm portföy

Kullanıcı işlemleri:

- Proje seçme
- Soru yazma
- "Yorumla" ile analiz alma

Örnek sorular:

- Bu projede en kritik riskler neler?
- Bu hafta hangi aksiyonlara odaklanmalıyım?
- Portföyde gecikme riski en yüksek projeler hangileri?
- Ticketlara göre ürün ekibine giden en önemli konular neler?

## 20. Raporlar

Raporlar ekranı iç operasyon, müşteri paylaşımı, teknik takip ve yönetici toplantıları için çıktılar sunar.

Erişim:

- Temel proje raporları tüm ilgili kullanıcılar tarafından alınabilir
- Yönetici raporları yalnızca yöneticilere açıktır

Rapor grupları:

- Operasyon
- Proje ve müşteri
- Teknik
- Yönetici

Rapor türleri:

- Genel proje durum raporu
- Müşteri raporu
- Gecikme raporu
- Efor raporu
- Makine raporu
- Ticket durum raporu
- Portföy genel durum raporu
- Ekip kapasite raporu
- Risk portföyü raporu
- Steerco raporu

Formatlar:

- HTML
- PDF olarak yazdırılabilir HTML
- XLSX

CSV kullanılmaz.

### 20.1 Steerco Raporu

Amaç: Steering Committee veya üst seviye müşteri toplantılarında profesyonel çıktı almak.

İçerik:

- Proje genel durumu
- Tamamlanma yüzdesi
- Kritik riskler
- Geciken görevler
- Açık kararlar
- Müşteri bekleyenleri
- Efor ve kapsam özeti
- Devreye alma / makine durumu
- Sonraki dönem aksiyonları

## 21. Mail Merkezi

Amaç: Sistemden gönderilen e-postaların şablonlarını, manuel gönderimlerini ve rapor otomasyonlarını yönetmek.

Erişim: Yönetici.

### 21.1 Mail Şablonları

Şablonlarda dinamik alanlar kullanılabilir. Dinamik alanlar listeden seçilerek içeriğe eklenir.

Şablon alanları:

- Şablon adı
- Konu
- Ön başlık
- Giriş metni
- Gövde
- Buton metni
- Alt bilgi
- Aktif / pasif durumu

E-posta tasarımı müşteri markasını öne çıkarır. Corject bilgisi alt bölümde daha küçük şekilde "Sent by Corject for ..." mantığında yer alır.

### 21.2 Tenant / Müşteri Marka Bilgisi

Sistemi satın alan firma için marka bilgileri tutulabilir.

Alanlar:

- Firma adı
- Logo
- Logo rengi / vurgu rengi
- Reply-to adresi
- Web sitesi

Bu bilgiler mail şablonlarında kullanılır.

### 21.3 Manuel Mail Gönderimi

Yönetici seçtiği şablonu belirli bir e-posta adresine gönderebilir.

Kullanım:

1. Şablon seçilir.
2. Dinamik alanlar doldurulur.
3. Alıcı adresi girilir.
4. Mail manuel tetiklenir.

### 21.4 Rapor Otomasyonu

Amaç: Belirlenen raporların belirli kişilere düzenli gönderilmesi.

Alanlar:

- Proje
- Rapor türü
- Alıcılar
- Sıklık
- Saat
- Aktif / pasif

Sistem gönderim sonucunu log olarak saklar. Böylece mailin gidip gitmediği ve hata varsa nedeni takip edilebilir.

## 22. Import Merkezi

Amaç: Başka uygulamalardan Corject'e veri taşımak.

Erişim: Yönetici.

Import edilebilen veri türleri:

- Kişiler
- Projeler
- Milestonelar
- Görevler
- Ticketlar
- Proje aksiyonları
- Saha planları
- Kişisel görevler
- To-Do kayıtları

Kullanıcı işlemleri:

- Şablon indirme
- Excel yükleme
- Ön izleme
- Veriyi sisteme aktarma

Örnek senaryo:

Eski takip dosyasındaki proje ve görev listesi Corject import şablonuna taşınır. Yönetici dosyayı yükler, ön izleme sonrası içeri aktarır.

## 23. Ekip ve Organizasyon

Amaç: Kullanıcıları, rollerini ve organizasyonel hiyerarşiyi yönetmek.

Erişim:

- Kullanıcı listesi tüm kullanıcılara görünebilir
- Kullanıcı ekleme ve düzenleme yönetici yetkisindedir

Alanlar:

- Ad soyad
- E-posta
- Telefon
- İl
- İlçe
- Organizasyon seviyesi
- Bağlı olduğu yönetici
- Yönetici yetkisi
- Sadece ticket kullanıcısı
- WhatsApp bildirimi

Varsayılan organizasyon kırılımı:

- CEO
- COO
- Operasyon Direktörü
- Proje Müdürü
- Proje Yöneticisi
- Süreç Lideri
- Saha Mühendisi

Kullanıcı işlemleri:

- Kişi ekleme
- Kişi düzenleme
- Organizasyonel rol ekleme
- Yönetici atama
- Ağaç görünümünde organizasyonu izleme
- Kişi detayında görev ve gecikmeleri görme

## 24. Aktivite Günlüğü

Amaç: Sistemde yapılan önemli işlemleri geçmişe dönük izlemek.

Erişim: Kullanıcılar ve yöneticiler.

Filtreler:

- Tüm projeler
- Proje bazlı filtre

Kayıt türleri:

- Proje oluşturma
- Görev ekleme
- Görev silme
- Görev tamamlama
- Durum değişikliği
- Risk ekleme
- Import
- Kişi ekleme

## 25. Bildirimler

Bildirim ekranı kullanıcıya gelen sistem bildirimlerini listeler.

Bildirim kaynakları:

- Görev atamaları
- Ticket atamaları
- Termin uyarıları
- Sistem içi hatırlatmalar

Kullanıcı işlemleri:

- Bildirimi okundu işaretleme
- Bildirimleri temizleme

## 26. Entegrasyonlar

### 26.1 Jira

Amaç: Corject ticketlarını Jira tasklarıyla ilişkilendirmek.

Kullanım:

- Ticket detayında Jira Task Key girilir
- Jira bilgileri yenilenebilir
- Jira'da Aç butonu ilgili taska götürür
- Jira webhook geldiğinde ticket içindeki Jira durumu güncellenir

Jira'dan izlenen bilgiler:

- Issue key
- Issue id
- Özet
- Açıklama
- Durum
- Sorumlu
- Öncelik
- Link

### 26.2 Slack

Amaç: Kullanıcı girişini ve görev bildirimlerini Slack üzerinden yönetmek.

Kullanım:

- Slack ile giriş
- Görev atandığında Slack mesajı
- Slack profil fotoğrafının kullanıcı profiline yansıması

### 26.3 WhatsApp

Amaç: Görev atamalarını WhatsApp Business Cloud API üzerinden bildirmek.

Kullanım:

- Kullanıcı telefon numarası ülke koduyla kaydedilir
- WhatsApp bildirimi açık olmalıdır
- Meta şablonu onaylandıysa görev atama bildirimi gönderilir
- WhatsApp başarısız olursa e-posta yedek kanal olarak kullanılabilir

### 26.4 E-posta / Resend

Amaç: Ticket atama, görev hatırlatma, rapor gönderimi ve manuel şablon mailleri göndermek.

Kullanım alanları:

- Ticket atama bildirimi
- Geciken görev hatırlatması
- Rapor otomasyonu
- Jira Done haftalık bülteni
- Manuel şablon gönderimi

### 26.5 Supabase

Amaç: Uygulama verilerini, oturumu ve kullanıcı eşleştirmelerini saklamak.

Son kullanıcı için anlamı:

- Veriler ortak ortamda saklanır
- Farklı cihazlardan erişim sağlanabilir
- Kullanıcı yetkilerine göre veri görünürlüğü uygulanır

## 27. Mobil Kullanım Notları

Mobil arayüz sahadaki hızlı kullanım için optimize edilmiştir.

Önerilen kullanım:

- Alt menüden günlük işlere erişin
- Orta `Ekle` butonuyla hızlı kayıt açın
- Profil fotoğrafıyla kendi projelerinize gidin
- Sağ üst üç çizgili menüden tüm özelliklere ulaşın
- Telefonun geri hareketiyle proje detayından listeye dönün

## 28. Örnek Uçtan Uca Senaryolar

### 28.1 Yeni Proje Başlatma

1. Yönetici veya PM Projeler ekranından yeni proje oluşturur.
2. Hazır MES şablonu seçilir.
3. Proje yöneticileri ve proje rolleri atanır.
4. Müşteri kontakları ve RACI bilgileri girilir.
5. Başlangıç sağlığı checklisti doldurulur.
6. Skor 80 üzerindeyse proje başlatılır.
7. Proje planı ve görevler takip edilir.

### 28.2 Saha Ziyareti Planlama ve Efor Kaydı

1. Kullanıcı Saha Yönetimi ekranına gider.
2. Haftalık planda ilgili güne saha ziyareti ekler.
3. Ziyaret tamamlandığında gerçekleşen saatleri ve notları girer.
4. Gidiş-dönüş kilometre girilirse yakıt maliyeti hesaplanır.
5. Girilen not proje aksiyonlarında, efor ise proje efor merkezinde görünür.

### 28.3 Ticketın Jira ile Takibi

1. Operasyon ekibi müşteri talebi için ticket açar.
2. Ticket ürün ekibine atanır.
3. Ürün ekibi Jira task key bilgisini ticketa girer.
4. Jira taskı test aşamasına geldiğinde ticket operasyon testine döner.
5. Test başarılıysa Yayına Hazır yapılır.
6. Müşteri onayı gerekiyorsa Müşteri Onayında durumuna alınır.
7. Süreç tamamlanınca ticket Tamamlandı olur.

### 28.4 Yönetici Haftalık Kontrol

1. Yönetici dashboardu açılır.
2. Kritik terminler, açık ticketlar ve risk radarı incelenir.
3. Ekip iş yükü kontrol edilir.
4. Yönetici rapor merkezinden genel durum veya steerco raporu alınır.
5. Gerekli aksiyonlar ilgili kişilere görev olarak atanır.

## 29. Sık Karşılaşılan Durumlar

### Kullanıcı proje göremiyor

Kullanıcının projeye PM, stakeholder veya görev sorumlusu olarak dahil olup olmadığı kontrol edilir. Yönetici tüm projeleri görebilir.

### Ticket maili gitmedi

Kullanıcının e-posta adresi, mail servis ayarları ve ticketın atanmış kişi alanı kontrol edilir. Mail merkezi veya otomasyon loglarından hata görülebilir.

### Slack ile giriş yapılamıyor

Slack hesabındaki e-posta adresi ile Corject kullanıcı kaydındaki e-posta aynı olmalıdır.

### Jira bilgisi görünmüyor

Ticket içinde Jira Task Key girilmiş olmalıdır. Jira entegrasyon ayarları ve Jira erişim bilgileri doğru olmalıdır.

### Geciken görev görünmüyor

Görevin termin tarihi geçmiş olmalı ve görev tamamlandı durumunda olmamalıdır.

## 30. Kısa Terimler

- Proje: Müşteri veya iş kapsamı bazlı ana takip alanı
- Milestone: Proje içindeki ana faz
- Görev: Milestone altındaki yapılacak iş
- Aksiyon: Projede yapılan görüşme, yazışma, karar veya çalışma kaydı
- To-Do: Kullanıcıya özel küçük takip aksiyonu
- Ticket: Müşteri talebi, hata, geliştirme veya destek kaydı
- RACI: Sorumluluk matrisi
- Devreye alma: Makine veya kapsamın kullanılabilir hale getirilmesi
- Efor: Saat bazında harcanan çalışma
- Steerco: Üst seviye proje yönlendirme toplantısı
