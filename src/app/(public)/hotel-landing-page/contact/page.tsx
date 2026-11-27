import { DM_Sans } from "next/font/google";
import { NavBar, Footer } from "../../../../modules/hotel-operating-system/hotel-landing-page";
import { ContactView } from "@/modules/hotel-operating-system/hotel-landing-page/pages/contact/ContactView";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Contact & Concierge | Luxury Stays",
  description: "Reach our hotel concierge team for booking inquiries, special requests, and directions.",
};

export default function ContactPage() {
  return (
    <main className={`${dmSans.className} min-h-screen bg-white flex flex-col`}>
      <NavBar />
      <div className="pt-28 pb-20 flex-grow">
        <ContactView />
      </div>
      <Footer />
    </main>
  );
}