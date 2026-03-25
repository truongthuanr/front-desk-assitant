"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createTicket, TicketResponse } from "@/lib/tickets";

export default function IssueTicketPage() {
  const [name, setName] = useState("Guest User");
  const [phone, setPhone] = useState("0900000000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setErrorMessage("Vui long nhap day du ho ten va so dien thoai");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const requestId = `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

    try {
      const data = await createTicket({
        request_id: requestId,
        user_info: {
          name: trimmedName,
          phone: trimmedPhone,
        },
      });
      setTicket(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Khong the tao ticket luc nay");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="issue-ticket-shell">
      <Card className="issue-ticket-card">
        <div className="issue-ticket-header">
          <h1>Dang ky / Lay so thu tu</h1>
          <p>Nhap thong tin co ban de tao ticket tren he thong kiosk.</p>
        </div>

        <form className="issue-ticket-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Ho ten</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nguyen Van A"
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span>So dien thoai</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0900000000"
              autoComplete="tel"
              inputMode="numeric"
            />
          </label>

          <div className="issue-ticket-actions">
            <Button type="submit" variant="default" className="confirm-btn" disabled={isSubmitting}>
              {isSubmitting ? "Dang xu ly..." : "Xac nhan lay so"}
            </Button>
            <Link href="/" className="back-btn">
              Quay lai trang chu
            </Link>
          </div>
        </form>

        {errorMessage && <p className="issue-ticket-error">{errorMessage}</p>}

        {ticket && (
          <Card className="issue-ticket-result">
            <h2>Ket qua lay so</h2>
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
            <p>
              Order: <strong>{ticket.order.order_id}</strong>
            </p>
          </Card>
        )}
      </Card>
    </main>
  );
}
