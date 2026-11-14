import {render,screen} from '@testing-library/react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {vi,test,expect} from 'vitest';import {StatusBar} from './StatusBar';
vi.mock('../api/client',()=>({api:{summary:()=>Promise.resolve({online_feeds:1,total:10000,last_sync:new Date().toISOString()})}}));
test('shows indicator count',async()=>{render(<QueryClientProvider client={new QueryClient()}><StatusBar/></QueryClientProvider>);expect(await screen.findByText(/10,000/)).toBeInTheDocument()});

