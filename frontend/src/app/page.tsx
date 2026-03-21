import Image from "next/image";

const serviceCards = [
  { title: "Dang ky\nkham benh", icon: "🗓️", primary: true },
  { title: "Tra cuu\nlich hen", icon: "🕒" },
  { title: "So do\nbenh vien", icon: "📍" },
  { title: "Giai dap\nthac mac", icon: "🎙️" },
];

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-canvas">
        <Image
          src="/assets/leaf.png"
          alt=""
          width={480}
          height={320}
          className="leaf leaf-top"
          priority
        />
        <Image
          src="/assets/leaf.png"
          alt=""
          width={430}
          height={280}
          className="leaf leaf-bottom"
        />

        <aside className="left-panel">
          <div className="brand">
            <Image src="/assets/logo.png" alt="Hospital Assistant logo" width={72} height={72} />
            <p className="brand-text">Hospital Assistant</p>
          </div>
          <h1 className="headline">
            Xin chao!
            <br />
            Toi co the giup
            <br />
            gi cho ban
            <br />
            hom nay?
          </h1>
        </aside>

        <section className="right-panel" aria-label="Main services">
          <header className="hero">
            <p className="bubble">Hay chon dich vu hoac tro chuyen voi toi.</p>
            <Image src="/assets/robot.png" alt="Hospital assistant robot" width={320} height={420} className="robot" />
          </header>

          <div className="service-grid">
            {serviceCards.map((card) => (
              <button
                key={card.title}
                type="button"
                className={`service-card ${card.primary ? "service-card-primary" : ""}`}
              >
                <span className="service-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <span className="service-title">{card.title}</span>
              </button>
            ))}
          </div>

          <div className="quick-actions">
            <button type="button" className="pill">
              💬 Tro chuyen truc tiep
            </button>
            <button type="button" className="pill">
              🌐 Ngon ngu
            </button>
            <button type="button" className="pill emergency">
              📞 Ho tro khan cap
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
