import { Button } from "../components/ui/button";
import { Menu } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const Heroheader = () => {
  return (
    <header className="sticky top-0 left-0 right-0 flex items-center h-[64px] md:h-[72px] px-4 md:px-8 z-50 bg-transparent backdrop-blur-md">
      {/* Logo */}
      <div className="font-display text-xl md:text-2xlh-full bg-gradient-to-r font-extrabold text-brand">
        Tsing
      </div>

      {/* Menu mobile */}
      <div className="md:hidden flex-1 flex justify-end">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="icon" aria-label="Ouvrir le menu">
              <Menu className="h-6 w-6" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="bg-white rounded-lg shadow-lg p-2 min-w-[200px]">
              <DropdownMenu.Item className="outline-none">
                <a
                  href="/archive"
                  className="block px-4 py-2 text-lg font-display text-black hover:bg-gray-100 rounded transition-colors duration-200 hover:text-brand hover:underline"
                >
                  Archive
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="outline-none">
                <a
                  href="/ecommerce"
                  className="block px-4 py-2 text-lg font-display text-black hover:bg-gray-100 rounded transition-colors duration-200 hover:text-brand hover:underline"
                >
                  E-commerce
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="outline-none">
                <a
                  href="/client"
                  className="block px-4 py-2 text-lg font-display text-black hover:bg-gray-100 rounded transition-colors duration-200 hover:text-brand hover:underline"
                >
                  Client
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-gray-200 my-2" />
              <DropdownMenu.Item className="outline-none">
                <a href="/archive" className="w-full block">
                  <Button className="w-full h-[40px] bg-brand rounded-[10px] shadow-md hover:bg-brand-hover transition-transform duration-200 hover:scale-105 active:scale-95">
                    <span className="font-display font-normal text-white text-lg">
                      Essai Gratuit
                    </span>
                  </Button>
                </a>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Menu desktop */}
      <nav className="hidden md:flex flex-1 justify-center space-x-8 mx-4">
        <a
          href="/archive"
          className="font-display font-normal text-xl text-black hover:text-brand hover:underline transition-colors duration-200"
        >
          Archive
        </a>
        <a
          href="/ecommerce"
          className="font-display font-normal text-xl text-black hover:text-brand hover:underline transition-colors duration-200"
        >
          E-commerce
        </a>
        <a
          href="/client"
          className="font-display font-normal text-xl text-black hover:text-brand hover:underline transition-colors duration-200"
        >
          Client
        </a>
      </nav>

      {/* Bouton desktop */}
      <a href="/archive" className="hidden md:block">
        <Button className="w-[200px] h-[50px] bg-brand rounded-[10px] shadow-md hover:bg-brand-hover transition-transform duration-200 hover:scale-105 active:scale-95">
          <span className="font-display font-normal text-white text-xl">
            Essai Gratuit
          </span>
        </Button>
      </a>
    </header>
  );
};

export default Heroheader;
