import { SiteHeader } from "@/components/site/SiteHeader";

export default function PropertiesLayout({ children }: LayoutProps<"/properties">) {
  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />
      <main className="flex flex-col gap-8 pt-6 pb-16 sm:pt-10">{children}</main>
    </div>
  );
}
