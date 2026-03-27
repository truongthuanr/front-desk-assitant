"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  CircleHelp,
  Clock3,
  Globe2,
  MapPinned,
  MessageCircleMore,
  MicVocal,
  Phone,
} from "lucide-react";

type Action = "issue-ticket" | "coming-soon";

type ServiceItem = {
  id: string;
  title: string;
  accent: "green" | "beige";
  icon: ReactNode;
  action: Action;
};

const services: ServiceItem[] = [
  { id: "register", title: "Đăng ký\nkhám bệnh", accent: "beige", icon: <CalendarDays size={48} />, action: "issue-ticket" },
  { id: "appointment", title: "Tra cứu\nlịch hẹn", accent: "green", icon: <Clock3 size={48} />, action: "coming-soon" },
  { id: "map", title: "Sơ đồ\nbệnh viện", accent: "green", icon: <MapPinned size={48} />, action: "coming-soon" },
  {
    id: "faq",
    title: "Giải đáp\nthắc mắc",
    accent: "beige",
    icon: (
      <span className="faq-icon" aria-hidden="true">
        <CircleHelp size={40} />
        <MicVocal size={32} />
      </span>
    ),
    action: "coming-soon",
  },
];

export default function HomePage() {
  const router = useRouter();

  const handleAction = (action: Action) => {
    if (action === "issue-ticket") {
      router.push("/issue-ticket");
      return;
    }
    window.alert("Tính năng này đang được cập nhật");
  };

  return (
    <main className="home-shell">
      <section className="home-canvas" aria-label="Hospital Assistant Home">
        <Image src="/assets/leaf.png" alt="" width={620} height={420} className="leaf leaf-top" priority />
        <Image src="/assets/leaf.png" alt="" width={620} height={420} className="leaf leaf-bottom" />

        <aside className="left-panel">
          <div className="brand">
            <Image src="/assets/logo.png" alt="Hospital Assistant logo" width={84} height={84} />
            <div className="brand-copy">
              <p>Hospital</p>
              <p>Assistant</p>
            </div>
          </div>
          <h1 className="headline">Xin chào! Tôi có thể giúp gì cho bạn hôm nay?</h1>
        </aside>

        <section className="right-panel">
          <header className="hero">
            <p className="bubble">Hãy chọn dịch vụ hoặc trò chuyện với tôi.</p>
            <div className="robot-wrap">
              <Image src="/assets/robot.png" alt="Hospital assistant robot" width={460} height={460} className="robot" />
            </div>
          </header>

          <div className="service-grid">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`service-card ${service.accent === "beige" ? "service-card-beige" : "service-card-green"}`}
                onClick={() => handleAction(service.action)}
              >
                <span className="service-icon">{service.icon}</span>
                <span className="service-title">{service.title}</span>
              </button>
            ))}
          </div>

          <div className="quick-actions">
            <button type="button" className="quick-pill" onClick={() => handleAction("coming-soon")}>
              <MessageCircleMore size={27} />
              Trò chuyện trực tiếp
            </button>
            <button type="button" className="quick-pill" onClick={() => handleAction("coming-soon")}>
              <Globe2 size={27} />
              Ngôn ngữ
            </button>
            <button type="button" className="quick-pill emergency" onClick={() => handleAction("coming-soon")}>
              <Phone size={27} />
              Hỗ trợ khẩn cấp
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
