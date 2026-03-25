"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const serviceCards = [
  { id: "issue-ticket", title: "ĐĂNG KÝ\nKHÁM BỆNH", icon: "🗓️", primary: true },
  { title: "TRA CỨU\nLỊCH HẸN", icon: "🕒" },
  { title: "SƠ ĐỒ\nBỆNH VIỆN", icon: "📍" },
  { title: "GIẢI ĐÁP\nTHẮC MẮC", icon: "🎙️", primary: true },
];
const ROBOT_ASSET_VERSION = "20260325-1";

export default function HomePage() {
  const router = useRouter();

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
            Xin chào!
            <br />
            Tôi có thể giúp
            <br />
            gì cho bạn
            <br />
            hôm nay?
          </h1>
        </aside>

        <section className="right-panel" aria-label="Main services">
          <header className="hero">
            <p className="bubble">Hãy chọn dịch vụ hoặc trò chuyện với tôi.</p>
            <Image
              src={`/assets/robot.png?v=${ROBOT_ASSET_VERSION}`}
              alt="Hospital assistant robot"
              width={320}
              height={420}
              className="robot"
              unoptimized
            />
          </header>

          <div className="service-grid">
            {serviceCards.map((card) => (
              <Card
                key={card.title}
                className={`service-card ${card.primary ? "service-card-primary" : ""}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="service-card-button"
                  onClick={
                    card.id === "issue-ticket"
                      ? () => router.push("/issue-ticket")
                      : () => window.alert("Tinh nang nay dang duoc cap nhat")
                  }
                >
                  <span className="service-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className="service-title">{card.title}</span>
                </Button>
              </Card>
            ))}
          </div>

          <div className="quick-actions">
            <Button type="button" variant="secondary" className="pill">
              💬 Trò chuyện trực tiếp
            </Button>
            <Button type="button" variant="secondary" className="pill">
              🌐 Ngôn ngữ
            </Button>
            <Button type="button" variant="destructive" className="pill emergency">
              📞 Hỗ trợ khẩn cấp
            </Button>
          </div>

        </section>
      </section>
    </main>
  );
}
