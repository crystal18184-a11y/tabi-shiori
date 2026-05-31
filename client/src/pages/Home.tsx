// 旅のしおり - メインページ
import { TabiProvider } from "@/contexts/TabiContext";
import TabiApp from "@/components/TabiApp";

export default function Home() {
  return (
    <TabiProvider>
      <TabiApp />
    </TabiProvider>
  );
}
