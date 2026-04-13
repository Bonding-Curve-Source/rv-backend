/**
 * Factory — khớp TokenFactory.sol đang deploy (TokenCreated có targetValue).
 */
export const factoryAbi = [
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'bondingCurve', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'raiseToken', type: 'address', indexed: false },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'targetValue', type: 'uint256', indexed: false },
    ],
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'getTokenInfo',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'address', name: 'tokenAddress', type: 'address' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
          { internalType: 'address payable', name: 'bondingCurve', type: 'address' },
          { internalType: 'address', name: 'raiseToken', type: 'address' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'string', name: 'imageUrl', type: 'string' },
          { internalType: 'string', name: 'twitter', type: 'string' },
          { internalType: 'string', name: 'telegram', type: 'string' },
          { internalType: 'string', name: 'website', type: 'string' },
        ],
        internalType: 'struct TokenFactory.TokenInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Topic0 TokenCreated — TokenCreated(address,address,address,address,string,string,uint256) */
export const TOKEN_CREATED =
  'TokenCreated(address,address,address,address,string,string,uint256)' as const;
