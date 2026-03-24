"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const serviceCards = [
  { id: "issue-ticket", title: "Dang ky\nkham benh", icon: "🗓️", primary: true },
  { title: "Tra cuu\nlich hen", icon: "🕒" },
  { title: "So do\nbenh vien", icon: "📍" },
  { title: "Giai dap\nthac mac", icon: "🎙️" },
];

type TicketResponse = {
  ticket_code: string;
  general_queue: {
    queue_name: string;
    queue_number: number;
    queue_position: number;
  };
  routing: {
    status: string;
  };
  order: {
    order_id: string;
  };
  created_at: string;
};

export default function HomePage() {
  const [phone, setPhone] = useState("0900000000");
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketResponse | null>(null);

  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    []
  );

  async function handleIssueTicket() {
    setIssueError(null);
    setIsIssuing(true);

    const requestId = `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({
          request_id: requestId,
          user_info: {
            name: "Guest User",
            phone: phone.trim(),
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(errorPayload?.detail ?? `REQUEST_FAILED_${response.status}`);
      }

      const data = (await response.json()) as TicketResponse;
      setTicket(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Khong the tao ticket luc nay";
      setIssueError(message);
    } finally {
      setIsIssuing(false);
    }
  }

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
              <Card
                key={card.title}
                className={`service-card ${card.primary ? "service-card-primary" : ""}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="service-card-button"
                  disabled={isIssuing && card.id === "issue-ticket"}
                  onClick={
                    card.id === "issue-ticket"
                      ? handleIssueTicket
                      : () => setIssueError("Tinh nang nay dang duoc cap nhat")
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
              💬 Tro chuyen truc tiep
            </Button>
            <Button type="button" variant="secondary" className="pill">
              🌐 Ngon ngu
            </Button>
            <Button type="button" variant="destructive" className="pill emergency">
              📞 Ho tro khan cap
            </Button>
          </div>

          <Card className="ticket-result">
            <div className="ticket-result-header">
              <p className="ticket-result-title">Lay so thu tu</p>
              <label className="ticket-phone">
                <span>So dien thoai</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Nhap so dien thoai"
                />
              </label>
            </div>

            {isIssuing && <p className="ticket-result-hint">Dang tao ticket...</p>}

            {!isIssuing && issueError && <p className="ticket-result-error">{issueError}</p>}

            {!isIssuing && !issueError && ticket && (
              <div className="ticket-result-data">
                <p>
                  Ma so: <strong>{ticket.ticket_code}</strong>
                </p>
                <p>
                  Queue: <strong>{ticket.general_queue.queue_name}</strong>
                </p>
                <p>
                  So thu tu: <strong>{ticket.general_queue.queue_number}</strong>
                </p>
                <p>
                  Vi tri hien tai: <strong>{ticket.general_queue.queue_position}</strong>
                </p>
                <p>
                  Routing: <strong>{ticket.routing.status}</strong>
                </p>
              </div>
            )}
          </Card>
        </section>
      </section>
    </main>
  );
}
