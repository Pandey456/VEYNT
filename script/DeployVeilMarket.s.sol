// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VeilMarket} from "../src/VeilMarket.sol";

contract DeployVeilMarket is Script {
    VeilMarket public veilMarket;

    function run() public {
        // =========================================================
        // HARDCODED CONSTRUCTOR ARGUMENTS (No .env file required)
        // =========================================================

        // 1. Coston2 FtsoV2 Proxy Address
        address ftsoV2Address = 0x3D89fDcfe3A5e5B84774B39965b7fCeBdDBCfb76;

        // 2. Standard FLR/USD Feed ID for Coston2
        bytes21 flrUsdFeedId = bytes21(
            0x01464c522f55534400000000000000000000000000
        );

        // 3. Mock TEE Public Address (Standard Dev Key)
        address teeSigner = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

        // =========================================================

        // Execute Deployment
        vm.startBroadcast(); // Listens to your terminal command for the sender account

        veilMarket = new VeilMarket(ftsoV2Address, flrUsdFeedId, teeSigner);

        vm.stopBroadcast();

        // Log the results so you can copy-paste them to your frontend
        console2.log("==========================================");
        console2.log("VeilMarket deployed at:", address(veilMarket));
        console2.log("Authorized TEE Signer: ", teeSigner);
        console2.log("==========================================");
    }
}
